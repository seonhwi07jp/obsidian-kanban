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

// Regex patterns for timestamp matching
const START_TIME_PATTERN = /▶️\s*\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/g;
const END_TIME_PATTERN = /⏹️\s*\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/g;
const COMPLETION_DATE_PATTERN = /✅\s*\d{4}-\d{2}-\d{2}/g;

// All timestamp patterns for finding the insertion point
const ALL_TIMESTAMP_PATTERNS = [
  START_TIME_PATTERN,
  END_TIME_PATTERN,
  COMPLETION_DATE_PATTERN,
];

export enum TimestampType {
  START = 'start',      // ▶️ - In Progress
  END = 'end',          // ⏹️ - Done time
  COMPLETION = 'completion', // ✅ - Done date
}

interface TimestampConfig {
  emoji: string;
  pattern: RegExp;
  formatFn: () => string;
}

const TIMESTAMP_CONFIGS: Record<TimestampType, TimestampConfig> = {
  [TimestampType.START]: {
    emoji: '▶️',
    pattern: START_TIME_PATTERN,
    formatFn: () => moment().format('YYYY-MM-DD HH:mm'),
  },
  [TimestampType.END]: {
    emoji: '⏹️',
    pattern: END_TIME_PATTERN,
    formatFn: () => moment().format('YYYY-MM-DD HH:mm'),
  },
  [TimestampType.COMPLETION]: {
    emoji: '✅',
    pattern: COMPLETION_DATE_PATTERN,
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
  
  // Reset the pattern's lastIndex for fresh matching
  config.pattern.lastIndex = 0;
  
  // Check if the timestamp already exists
  if (config.pattern.test(titleRaw)) {
    // Reset lastIndex after test
    config.pattern.lastIndex = 0;
    // Replace existing timestamp with new one
    return titleRaw.replace(config.pattern, newTimestamp);
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
  config.pattern.lastIndex = 0;
  
  // Remove the timestamp and any trailing/leading whitespace cleanup
  let result = titleRaw.replace(config.pattern, '');
  
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
  config.pattern.lastIndex = 0;
  return config.pattern.test(titleRaw);
}

/**
 * Append a timestamp at the correct position based on the ordering rules.
 * Order: content -> ✅ (completion) -> ▶️ (start) -> ⏹️ (end)
 */
function appendTimestampInOrder(titleRaw: string, type: TimestampType, newTimestamp: string): string {
  // Find positions of existing timestamps
  const positions = findTimestampPositions(titleRaw);
  
  let insertPosition = titleRaw.length;
  
  switch (type) {
    case TimestampType.COMPLETION:
      // ✅ should be before ▶️ and ⏹️
      if (positions.start !== -1) {
        insertPosition = positions.start;
      } else if (positions.end !== -1) {
        insertPosition = positions.end;
      }
      break;
      
    case TimestampType.START:
      // ▶️ should be after ✅ but before ⏹️
      if (positions.end !== -1) {
        insertPosition = positions.end;
      }
      // If completion exists, we go after it (which means end of string or before end)
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
function findTimestampPositions(titleRaw: string): { completion: number; start: number; end: number } {
  const result = { completion: -1, start: -1, end: -1 };
  
  // Find completion date position (✅)
  COMPLETION_DATE_PATTERN.lastIndex = 0;
  const completionMatch = COMPLETION_DATE_PATTERN.exec(titleRaw);
  if (completionMatch) {
    result.completion = completionMatch.index;
  }
  
  // Find start time position (▶️)
  START_TIME_PATTERN.lastIndex = 0;
  const startMatch = START_TIME_PATTERN.exec(titleRaw);
  if (startMatch) {
    result.start = startMatch.index;
  }
  
  // Find end time position (⏹️)
  END_TIME_PATTERN.lastIndex = 0;
  const endMatch = END_TIME_PATTERN.exec(titleRaw);
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
 * - Done → TODO: Remove all timestamps (▶️, ⏹️, ✅)
 * - InProgress → TODO: Remove ▶️
 * 
 * @param titleRaw - The raw title string of the task
 * @param destinationState - 'todo' | 'inprogress' | 'done'
 * @param sourceState - 'todo' | 'inprogress' | 'done'
 * @returns The updated title string
 */
export function applyStateTransitionTimestamps(
  titleRaw: string,
  destinationState: 'todo' | 'inprogress' | 'done',
  sourceState: 'todo' | 'inprogress' | 'done'
): string {
  let result = titleRaw;
  
  // No state change
  if (destinationState === sourceState) {
    return result;
  }
  
  // Moving TO InProgress
  if (destinationState === 'inprogress') {
    // Add/update start time
    result = upsertTimestamp(result, TimestampType.START);
    
    // If coming from Done, remove Done timestamps
    if (sourceState === 'done') {
      result = removeTimestamp(result, TimestampType.END);
      result = removeTimestamp(result, TimestampType.COMPLETION);
    }
  }
  
  // Moving TO Done
  else if (destinationState === 'done') {
    // Add/update end time and completion date
    result = upsertTimestamp(result, TimestampType.END);
    result = upsertTimestamp(result, TimestampType.COMPLETION);
  }
  
  // Moving TO Todo (from any state)
  else if (destinationState === 'todo') {
    // Remove all timestamps
    result = removeTimestamp(result, TimestampType.START);
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
  checkChar: string
): 'todo' | 'inprogress' | 'done' {
  // Lane properties take precedence
  if (shouldMarkItemsComplete) return 'done';
  if (shouldMarkItemsInProgress) return 'inprogress';
  
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
