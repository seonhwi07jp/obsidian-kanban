import update from 'immutability-helper';
import { memo, useContext } from 'preact/compat';
import { Path } from 'src/dnd/types';
import { getEntityFromPath } from 'src/dnd/util/data';

import { KanbanContext } from '../context';
import { c, maybeCompleteForMove } from '../helpers';
import { Item } from '../types';

export type LaneState = 'todo' | 'inprogress' | 'onhold' | 'done';

export interface ItemStateButtonsProps {
  item: Item;
  path: Path;
  laneState: LaneState;
}

interface StateButton {
  emoji: string;
  targetState: LaneState;
  title: string;
}

const STATE_BUTTONS: Record<LaneState, StateButton[]> = {
  todo: [
    { emoji: '▶️', targetState: 'inprogress', title: 'Start' },
  ],
  inprogress: [
    { emoji: '⏸️', targetState: 'onhold', title: 'Pause' },
    { emoji: '⏹️', targetState: 'done', title: 'Done' },
  ],
  onhold: [
    { emoji: '▶️', targetState: 'inprogress', title: 'Resume' },
  ],
  done: [
    { emoji: '▶️', targetState: 'inprogress', title: 'Reopen' },
  ],
};

export const ItemStateButtons = memo(function ItemStateButtons({
  item,
  path,
  laneState,
}: ItemStateButtonsProps) {
  const { stateManager } = useContext(KanbanContext);

  const buttons = STATE_BUTTONS[laneState] || [];

  if (buttons.length === 0) return null;

  const handleClick = (targetState: LaneState) => {
    // Find the target lane index
    const lanes = stateManager.state.children;
    let targetLaneIndex = -1;

    for (let i = 0; i < lanes.length; i++) {
      const lane = lanes[i];
      const isComplete = !!lane.data.shouldMarkItemsComplete;
      const isInProgress = !!lane.data.shouldMarkItemsInProgress;
      const isOnHold = !!lane.data.shouldMarkItemsOnHold;

      let laneLaneState: LaneState = 'todo';
      if (isComplete) laneLaneState = 'done';
      else if (isInProgress) laneLaneState = 'inprogress';
      else if (isOnHold) laneLaneState = 'onhold';

      if (laneLaneState === targetState) {
        targetLaneIndex = i;
        break;
      }
    }

    if (targetLaneIndex === -1) {
      // Target lane not found
      return;
    }

    // Move the item to the target lane (at the end)
    const targetLane = lanes[targetLaneIndex];
    const targetPath: Path = [targetLaneIndex, targetLane.children.length];

    stateManager.setState((boardData) => {
      // Get the source lane to pass to maybeCompleteForMove
      const sourceLane = getEntityFromPath(boardData, path.slice(0, -1));
      
      // Apply timestamp and completion logic
      const { next, replacement } = maybeCompleteForMove(
        stateManager,
        boardData,
        path,
        stateManager,
        boardData,
        targetPath,
        item
      );

      // Update the board with the new item
      let updates = {
        children: {
          [path[0]]: {
            children: {
              [path[1]]: { $set: next },
            },
          },
        },
      };

      // If there's a replacement (item was split), insert it
      if (replacement) {
        updates = {
          children: {
            [path[0]]: {
              children: {
                $splice: [[path[1], 1, next, replacement]],
              },
            },
          },
        };
      }

      let updatedBoard = update(boardData, updates);

      // Now move the item(s) to the target lane
      const itemsToMove = replacement ? [next, replacement] : [next];
      const sourcePath = replacement ? [path[0], path[1]] : path;

      // Remove from source
      updatedBoard = update(updatedBoard, {
        children: {
          [sourcePath[0]]: {
            children: {
              $splice: [[sourcePath[1], itemsToMove.length]],
            },
          },
        },
      });

      // Add to target
      const insertIndex = targetLane.children.length;
      updatedBoard = update(updatedBoard, {
        children: {
          [targetLaneIndex]: {
            children: {
              $splice: [[insertIndex, 0, ...itemsToMove]],
            },
          },
        },
      });

      return updatedBoard;
    });
  };

  return (
    <div className={c('item-state-buttons')}>
      {buttons.map((button) => (
        <button
          key={button.targetState}
          className={c('item-state-button')}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            handleClick(button.targetState);
          }}
          title={button.title}
        >
          {button.emoji}
        </button>
      ))}
    </div>
  );
});
