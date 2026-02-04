import { moment } from 'obsidian';

/**
 * Timestamp utility functions for Kanban card state tracking.
 * 
 * State tracking markers:
 * - ▶️ YYYY-MM-DD HH:mm - In Progress start time
 * - ⏹️ YYYY-MM-DD HH:mm - Done end time
 * - ✅ YYYY-MM-DD - Done completion date
 * 
 * Order: content -> created date -> completion date (✅) -> start time (▶️) -> end time (⏹️)
 */

// Pattern strings for timestamp matching (without /g flag - we create fresh RegExp each time)
const START_TIME_PATTERN_STR = '▶️\\s*\\d{4}-\\d{2}-\\d{2}\\s+\\d{2}:\\d{2}';
const PAUSE_TIME_PATTERN_STR = '⏸️\\s*\\d{4}-\\d{2}-\\d{2}\\s+\\d{2}:\\d{2}';
const END_TIME_PATTERN_STR = '⏹️\\s*\\d{4}-\\d{2}-\\d{2}\\s+\\d{2}:\\d{2}';
const COMPLETION_DATE_PATTERN_STR = '✅\\s*\\d{4}-\\d{2}-\\d{2}';

// Factory functions to create fresh RegExp objects each time
function createStartTimePattern(): RegExp {
  return new RegExp(START_TIME_PATTERN_STR, 'g');
}

function createPauseTimePattern(): RegExp {
  return new RegExp(PAUSE_TIME_PATTERN_STR, 'g');
}

function createEndTimePattern(): RegExp {
  return new RegExp(END_TIME_PATTERN_STR, 'g');
}

function createCompletionDatePattern(): RegExp {
  return new RegExp(COMPLETION_DATE_PATTERN_STR, 'g');
}

export enum TimestampType {
  START = 'start',      // ▶️ - In Progress
  PAUSE = 'pause',      // ⏸️ - On Hold
  END = 'end',          // ⏹️ - Done time
  COMPLETION = 'completion', // ✅ - Done date
}

interface TimestampConfig {
  emoji: string;
  createPattern: () => RegExp;
  formatFn: () => string;
}

const TIMESTAMP_CONFIGS: Record<TimestampType, TimestampConfig> = {
  [TimestampType.START]: {
    emoji: '▶️',
    createPattern: createStartTimePattern,
    formatFn: () => moment().format('YYYY-MM-DD HH:mm'),
  },
  [TimestampType.PAUSE]: {
    emoji: '⏸️',
    createPattern: createPauseTimePattern,
    formatFn: () => moment().format('YYYY-MM-DD HH:mm'),
  },
  [TimestampType.END]: {
    emoji: '⏹️',
    createPattern: createEndTimePattern,
    formatFn: () => moment().format('YYYY-MM-DD HH:mm'),
  },
  [TimestampType.COMPLETION]: {
    emoji: '✅',
    createPattern: createCompletionDatePattern,
    formatFn: () => moment().format('YYYY-MM-DD'),
  },
};

/**
 * Helper to trim whitespace from end of string (ES2018 compatible)
 */
function trimEnd(str: string): string {
  return str.replace(/\s+$/, '');
}

/**
 * Helper to trim whitespace from start of string (ES2018 compatible)
 */
function trimStart(str: string): string {
  return str.replace(/^\s+/, '');
}

/**
 * Upsert a timestamp into the task title.
 * If the timestamp exists, update it. If not, append it.
 * 
 * @param titleRaw - The raw title string of the task
 * @param type - The type of timestamp to upsert
 * @returns The updated title string
 */
export function upsertTimestamp(titleRaw: string, type: TimestampType): string {
  const config = TIMESTAMP_CONFIGS[type];
  const newTimestamp = `${config.emoji} ${config.formatFn()}`;
  const pattern = config.createPattern();
  
  // Check if the timestamp already exists
  if (pattern.test(titleRaw)) {
    // Replace existing timestamp with new one (create fresh pattern for replace)
    return titleRaw.replace(config.createPattern(), newTimestamp);
  }
  
  // Timestamp doesn't exist, need to append at the correct position
  // Order: content -> ✅ -> ▶️ -> ⏹️
  return appendTimestampInOrder(titleRaw, type, newTimestamp);
}

/**
 * Remove a specific timestamp from the task title.
 * 
 * @param titleRaw - The raw title string of the task
 * @param type - The type of timestamp to remove
 * @returns The updated title string with the timestamp removed
 */
export function removeTimestamp(titleRaw: string, type: TimestampType): string {
  const config = TIMESTAMP_CONFIGS[type];
  const pattern = config.createPattern();
  
  // Remove the timestamp and any trailing/leading whitespace cleanup
  let result = titleRaw.replace(pattern, '');
  
  // Clean up multiple spaces
  result = result.replace(/\s{2,}/g, ' ').trim();
  
  return result;
}

/**
 * Check if a specific timestamp exists in the title.
 * 
 * @param titleRaw - The raw title string of the task
 * @param type - The type of timestamp to check
 * @returns True if the timestamp exists
 */
export function hasTimestamp(titleRaw: string, type: TimestampType): boolean {
  const config = TIMESTAMP_CONFIGS[type];
  const pattern = config.createPattern();
  return pattern.test(titleRaw);
}

/**
 * Append a timestamp at the correct position based on the ordering rules.
 * Order: content -> ✅ (completion) -> ▶️ (start) -> ⏸️ (pause) -> ⏹️ (end)
 */
function appendTimestampInOrder(titleRaw: string, type: TimestampType, newTimestamp: string): string {
  // Find positions of existing timestamps
  const positions = findTimestampPositions(titleRaw);
  
  let insertPosition = titleRaw.length;
  
  switch (type) {
    case TimestampType.COMPLETION:
      // ✅ should be before ▶️, ⏸️, and ⏹️
      if (positions.start !== -1) {
        insertPosition = positions.start;
      } else if (positions.pause !== -1) {
        insertPosition = positions.pause;
      } else if (positions.end !== -1) {
        insertPosition = positions.end;
      }
      break;
      
    case TimestampType.START:
      // ▶️ should be after ✅ but before ⏸️ and ⏹️
      if (positions.pause !== -1) {
        insertPosition = positions.pause;
      } else if (positions.end !== -1) {
        insertPosition = positions.end;
      }
      break;
      
    case TimestampType.PAUSE:
      // ⏸️ should be after ▶️ but before ⏹️
      if (positions.end !== -1) {
        insertPosition = positions.end;
      }
      break;
      
    case TimestampType.END:
      // ⏹️ should be at the very end
      insertPosition = titleRaw.length;
      break;
  }
  
  // Handle the insertion
  if (insertPosition === titleRaw.length) {
    // Append at end
    return `${trimEnd(titleRaw)} ${newTimestamp}`;
  } else {
    // Insert at position
    const before = trimEnd(titleRaw.slice(0, insertPosition));
    const after = titleRaw.slice(insertPosition);
    return `${before} ${newTimestamp}${after.startsWith(' ') ? '' : ' '}${trimStart(after)}`;
  }
}

/**
 * Find the starting positions of each timestamp type in the string.
 */
function findTimestampPositions(titleRaw: string): { completion: number; start: number; pause: number; end: number } {
  const result = { completion: -1, start: -1, pause: -1, end: -1 };
  
  // Find completion date position (✅)
  const completionPattern = createCompletionDatePattern();
  const completionMatch = completionPattern.exec(titleRaw);
  if (completionMatch) {
    result.completion = completionMatch.index;
  }
  
  // Find start time position (▶️)
  const startPattern = createStartTimePattern();
  const startMatch = startPattern.exec(titleRaw);
  if (startMatch) {
    result.start = startMatch.index;
  }
  
  // Find pause time position (⏸️)
  const pausePattern = createPauseTimePattern();
  const pauseMatch = pausePattern.exec(titleRaw);
  if (pauseMatch) {
    result.pause = pauseMatch.index;
  }
  
  // Find end time position (⏹️)
  const endPattern = createEndTimePattern();
  const endMatch = endPattern.exec(titleRaw);
  if (endMatch) {
    result.end = endMatch.index;
  }
  
  return result;
}

/**
 * Apply timestamps based on the card's transition to a new state.
 * 
 * State Transitions:
 * - TODO → InProgress: Add ▶️ (start time)
 * - InProgress → Done: Add ⏹️ (end time), Add ✅ (completion date)
 * - Done → InProgress: Remove ⏹️, Remove ✅, Update ▶️ (new start time)
 * - Done → TODO: Remove all timestamps (▶️, ⏸️, ⏹️, ✅)
 * - InProgress → TODO: Remove ▶️
 * - InProgress → OnHold: Add ⏸️ (pause time) ONLY if ▶️ exists (conditional guard)
 * - OnHold → InProgress: Remove ⏸️, Add new ▶️ (resume session)
 * - TODO → OnHold: No timestamp changes (just move)
 * - OnHold → TODO: Remove all timestamps
 * - OnHold → Done: Add ⏹️ (end time)
 * 
 * @param titleRaw - The raw title string of the task
 * @param destinationState - 'todo' | 'inprogress' | 'done' | 'onhold'
 * @param sourceState - 'todo' | 'inprogress' | 'done' | 'onhold'
 * @returns The updated title string
 */
export function applyStateTransitionTimestamps(
  titleRaw: string,
  destinationState: 'todo' | 'inprogress' | 'done' | 'onhold',
  sourceState: 'todo' | 'inprogress' | 'done' | 'onhold'
): string {
  let result = titleRaw;
  
  // No state change
  if (destinationState === sourceState) {
    return result;
  }
  
  // Moving TO InProgress
  if (destinationState === 'inprogress') {
    // From TODO: add new start time
    if (sourceState === 'todo') {
      result = upsertTimestamp(result, TimestampType.START);
    }
    
    // From OnHold: remove pause time, add new start time (resume session)
    if (sourceState === 'onhold') {
      result = removeTimestamp(result, TimestampType.PAUSE);
      result = upsertTimestamp(result, TimestampType.START);
    }
    
    // From Done: remove Done timestamps, add new start time
    if (sourceState === 'done') {
      result = removeTimestamp(result, TimestampType.END);
      result = removeTimestamp(result, TimestampType.COMPLETION);
      result = upsertTimestamp(result, TimestampType.START);
    }
  }
  
  // Moving TO OnHold
  else if (destinationState === 'onhold') {
    // From InProgress: add pause time ONLY if start time exists (conditional guard)
    if (sourceState === 'inprogress') {
      if (hasTimestamp(result, TimestampType.START)) {
        result = upsertTimestamp(result, TimestampType.PAUSE);
      }
      // If no start time exists, do nothing (just move without timestamp)
    }
    // From TODO: no timestamp changes (just move)
    // From Done: no specific handling, just move
  }
  
  // Moving TO Done
  else if (destinationState === 'done') {
    // Remove pause time if exists
    result = removeTimestamp(result, TimestampType.PAUSE);
    // Add/update end time only (completion date disabled - user already has time information)
    result = upsertTimestamp(result, TimestampType.END);
    // result = upsertTimestamp(result, TimestampType.COMPLETION);
  }
  
  // Moving TO Todo (from any state)
  else if (destinationState === 'todo') {
    // Remove all timestamps
    result = removeTimestamp(result, TimestampType.START);
    result = removeTimestamp(result, TimestampType.PAUSE);
    result = removeTimestamp(result, TimestampType.END);
    result = removeTimestamp(result, TimestampType.COMPLETION);
  }
  
  return result;
}

/**
 * Determine the state based on lane properties and check character.
 */
export function determineState(
  shouldMarkItemsInProgress: boolean | undefined,
  shouldMarkItemsComplete: boolean | undefined,
  shouldMarkItemsOnHold: boolean | undefined,
  checkChar: string
): 'todo' | 'inprogress' | 'done' | 'onhold' {
  // Lane properties take precedence
  if (shouldMarkItemsComplete) return 'done';
  if (shouldMarkItemsInProgress) return 'inprogress';
  if (shouldMarkItemsOnHold) return 'onhold';
  
  // Fall back to check character
  if (checkChar === 'x' || checkChar === 'X') return 'done';
  if (checkChar === '/') return 'inprogress';
  
  return 'todo';
}

/**
 * Get the check character for "In Progress" state.
 * This is "/" by convention in many task management systems.
 */
export function getInProgressCheckChar(): string {
  return '/';
}

/**
 * Check if a check character represents "In Progress" state.
 */
export function isInProgressCheckChar(checkChar: string): boolean {
  return checkChar === '/';
}
