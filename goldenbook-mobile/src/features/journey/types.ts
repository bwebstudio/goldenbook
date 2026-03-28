export type StepStatus = 'upcoming' | 'active' | 'arrived' | 'skipped' | 'completed';
export type JourneyStatus = 'active' | 'completed';

export interface JourneyState {
  currentStepIndex: number;
  stepStatuses: StepStatus[];
  journeyStatus: JourneyStatus;
}
