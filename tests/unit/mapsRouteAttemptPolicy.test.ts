import { describe, expect, it } from 'vitest';

import {
  MAX_BICYCLE_ROUTE_CHECK_KM,
  MAX_DRIVING_ROUTE_CHECK_KM,
  MAX_TRANSIT_ROUTE_CHECK_KM,
  MAX_WALK_ROUTE_CHECK_KM,
  TRANSIT_SECOND_PASS_MAX_KM,
  buildRouteAttemptPolicy,
  classifyRouteComputationError,
  mapRouteAttemptPolicyReasonToFailureReason,
} from '../../components/maps/routeAttemptPolicy';

describe('components/maps/routeAttemptPolicy', () => {
  it.each([
    ['walk', MAX_WALK_ROUTE_CHECK_KM, ['WALKING']],
    ['bicycle', MAX_BICYCLE_ROUTE_CHECK_KM, ['BICYCLING']],
    ['car', MAX_DRIVING_ROUTE_CHECK_KM, ['DRIVING']],
    ['motorcycle', MAX_DRIVING_ROUTE_CHECK_KM, ['DRIVING']],
    ['train', MAX_TRANSIT_ROUTE_CHECK_KM, ['TRANSIT']],
    ['bus', MAX_TRANSIT_ROUTE_CHECK_KM, ['TRANSIT']],
  ])('attempts %s up to and including its %s km cap, then stops', (mode, capKm, modes) => {
    expect(buildRouteAttemptPolicy(mode, capKm)).toEqual({ shouldAttempt: true, modes });
    expect(buildRouteAttemptPolicy(mode, capKm + 0.001)).toEqual({
      shouldAttempt: false,
      modes: [],
      reason: 'distance_cap_exceeded',
    });
  });

  it('gives short transit legs a second, less strict TRANSIT pass', () => {
    expect(buildRouteAttemptPolicy('train', TRANSIT_SECOND_PASS_MAX_KM).modes).toEqual(['TRANSIT', 'TRANSIT']);
    expect(buildRouteAttemptPolicy('bus', 1).modes).toEqual(['TRANSIT', 'TRANSIT']);
    expect(buildRouteAttemptPolicy('train', TRANSIT_SECOND_PASS_MAX_KM + 1).modes).toEqual(['TRANSIT']);
  });

  it.each([0, -5, Number.NaN, Number.POSITIVE_INFINITY])('rejects a straight distance of %s before looking at the mode', (distance) => {
    expect(buildRouteAttemptPolicy('car', distance)).toEqual({
      shouldAttempt: false,
      modes: [],
      reason: 'invalid_distance',
    });
  });

  it.each(['plane', 'boat', 'na', ''])('never asks the Routes API for %s legs', (mode) => {
    expect(buildRouteAttemptPolicy(mode, 10)).toEqual({
      shouldAttempt: false,
      modes: [],
      reason: 'unsupported_mode',
    });
  });

  it('maps each skip reason onto the matching route failure reason', () => {
    expect(mapRouteAttemptPolicyReasonToFailureReason('unsupported_mode')).toBe('unsupported_mode');
    expect(mapRouteAttemptPolicyReasonToFailureReason('distance_cap_exceeded')).toBe('distance_cap_exceeded');
    expect(mapRouteAttemptPolicyReasonToFailureReason('invalid_distance')).toBe('invalid_distance');
    expect(mapRouteAttemptPolicyReasonToFailureReason(undefined)).toBe('request_error');
  });

  it.each([
    [new Error('Routes returned ZERO_RESULTS'), 'zero_results'],
    ['No route could be found between these points', 'zero_results'],
    [new Error('No route path returned'), 'no_route_path'],
    [new Error('Route path is straight'), 'straight_path'],
    [new Error('Routes API unavailable'), 'api_unavailable'],
    [new Error('Something else broke'), 'request_error'],
    [{ message: 'ZERO_RESULTS' }, 'request_error'],
    [undefined, 'request_error'],
  ])('classifies %s as %s', (error, reason) => {
    expect(classifyRouteComputationError(error)).toBe(reason);
  });
});
