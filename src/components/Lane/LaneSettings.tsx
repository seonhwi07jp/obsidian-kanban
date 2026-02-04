import update from 'immutability-helper';
import { useContext } from 'preact/compat';
import { Path } from 'src/dnd/types';
import { t } from 'src/lang/helpers';

import { KanbanContext } from '../context';
import { c } from '../helpers';
import { EditState, Lane, isEditing } from '../types';

export interface LaneSettingsProps {
  lane: Lane;
  lanePath: Path;
  editState: EditState;
}

export function LaneSettings({ lane, lanePath, editState }: LaneSettingsProps) {
  const { boardModifiers } = useContext(KanbanContext);

  if (!isEditing(editState)) return null;

  return (
    <div className={c('lane-setting-wrapper')}>
      <div className={c('checkbox-wrapper')}>
        <div className={c('checkbox-label')}>{t('Mark cards in this list as in progress')}</div>
        <div
          onClick={() =>
            boardModifiers.updateLane(
              lanePath,
              update(lane, {
                data: {
                  $toggle: ['shouldMarkItemsInProgress'],
                  // If enabling in-progress, disable complete and on-hold (mutually exclusive)
                  ...(lane.data.shouldMarkItemsInProgress ? {} : { shouldMarkItemsComplete: { $set: false }, shouldMarkItemsOnHold: { $set: false } }),
                },
              })
            )
          }
          className={`checkbox-container ${lane.data.shouldMarkItemsInProgress ? 'is-enabled' : ''}`}
        />
      </div>
      <div className={c('checkbox-wrapper')}>
        <div className={c('checkbox-label')}>{t('Mark cards in this list as on hold')}</div>
        <div
          onClick={() =>
            boardModifiers.updateLane(
              lanePath,
              update(lane, {
                data: {
                  $toggle: ['shouldMarkItemsOnHold'],
                  // If enabling on-hold, disable complete and in-progress (mutually exclusive)
                  ...(lane.data.shouldMarkItemsOnHold ? {} : { shouldMarkItemsComplete: { $set: false }, shouldMarkItemsInProgress: { $set: false } }),
                },
              })
            )
          }
          className={`checkbox-container ${lane.data.shouldMarkItemsOnHold ? 'is-enabled' : ''}`}
        />
      </div>
      <div className={c('checkbox-wrapper')}>
        <div className={c('checkbox-label')}>{t('Mark cards in this list as complete')}</div>
        <div
          onClick={() =>
            boardModifiers.updateLane(
              lanePath,
              update(lane, {
                data: {
                  $toggle: ['shouldMarkItemsComplete'],
                  // If enabling complete, disable in-progress and on-hold (mutually exclusive)
                  ...(lane.data.shouldMarkItemsComplete ? {} : { shouldMarkItemsInProgress: { $set: false }, shouldMarkItemsOnHold: { $set: false } }),
                },
              })
            )
          }
          className={`checkbox-container ${lane.data.shouldMarkItemsComplete ? 'is-enabled' : ''}`}
        />
      </div>
    </div>
  );
}
