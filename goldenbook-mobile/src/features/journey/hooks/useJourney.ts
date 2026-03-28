import { useCallback, useState } from 'react';
import type { RoutePlaceDTO } from '@/features/routes/types';
import type { JourneyState, JourneyStatus, StepStatus } from '../types';

export function useJourney(places: RoutePlaceDTO[]) {
  const [state, setState] = useState<JourneyState>(() => ({
    currentStepIndex: 0,
    stepStatuses: places.map((_, i) =>
      (i === 0 ? 'active' : 'upcoming') as StepStatus,
    ),
    journeyStatus: 'active',
  }));

  const handleArrived = useCallback(() => {
    setState(prev => ({
      ...prev,
      stepStatuses: prev.stepStatuses.map((s, i) =>
        i === prev.currentStepIndex ? ('arrived' as StepStatus) : s,
      ),
    }));
  }, []);

  const handleContinue = useCallback(() => {
    setState(prev => {
      const next = prev.currentStepIndex + 1;

      if (next >= places.length) {
        return {
          ...prev,
          stepStatuses: prev.stepStatuses.map((s, i) =>
            i === prev.currentStepIndex ? ('completed' as StepStatus) : s,
          ),
          journeyStatus: 'completed' as JourneyStatus,
        };
      }

      return {
        currentStepIndex: next,
        stepStatuses: prev.stepStatuses.map((s, i) => {
          if (i === prev.currentStepIndex) return 'completed' as StepStatus;
          if (i === next) return 'active' as StepStatus;
          return s;
        }),
        journeyStatus: 'active' as JourneyStatus,
      };
    });
  }, [places.length]);

  const handleSkip = useCallback(() => {
    setState(prev => {
      const next = prev.currentStepIndex + 1;

      if (next >= places.length) {
        return {
          ...prev,
          stepStatuses: prev.stepStatuses.map((s, i) =>
            i === prev.currentStepIndex ? ('skipped' as StepStatus) : s,
          ),
          journeyStatus: 'completed' as JourneyStatus,
        };
      }

      return {
        currentStepIndex: next,
        stepStatuses: prev.stepStatuses.map((s, i) => {
          if (i === prev.currentStepIndex) return 'skipped' as StepStatus;
          if (i === next) return 'active' as StepStatus;
          return s;
        }),
        journeyStatus: 'active' as JourneyStatus,
      };
    });
  }, [places.length]);

  return { state, handleArrived, handleContinue, handleSkip };
}
