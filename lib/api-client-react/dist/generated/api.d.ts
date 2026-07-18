import type { QueryKey, UseMutationOptions, UseMutationResult, UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import type { AiPlayerSummary, AiRosterExplanation, Coach, CoachDraft, CoachNote, CsvImport, DraftPick, DraftPlayerBody, Evaluation, EvaluationInput, EvaluationUpdate, HealthStatus, ImportResult, ListEvaluationsParams, ListNotesParams, ListPlayersParams, ListRankingsParams, MustHaveInput, MustHavePick, NewCoachBody, NoteInput, NoteUpdate, Player, PlayerDetail, PlayerInput, PlayerLockInput, PlayerUpdate, RankedPlayer, RankingOverride, Roster, RosterDetail, RosterInput, RosterPlayerInput, RosterSuggestion, RosterUpdate, SheetsSyncRequest, SyncStatus, SyncTrigger, TryoutStats, WishlistInput, WishlistPick } from './api.schemas';
import { customFetch } from '../custom-fetch';
import type { ErrorType, BodyType } from '../custom-fetch';
type AwaitedInput<T> = PromiseLike<T> | T;
type Awaited<O> = O extends AwaitedInput<infer T> ? T : never;
type SecondParameter<T extends (...args: never) => unknown> = Parameters<T>[1];
export declare const getHealthCheckUrl: () => string;
/**
 * @summary Health check
 */
export declare const healthCheck: (options?: RequestInit) => Promise<HealthStatus>;
export declare const getHealthCheckQueryKey: () => readonly ["/api/healthz"];
export declare const getHealthCheckQueryOptions: <TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData> & {
    queryKey: QueryKey;
};
export type HealthCheckQueryResult = NonNullable<Awaited<ReturnType<typeof healthCheck>>>;
export type HealthCheckQueryError = ErrorType<unknown>;
/**
 * @summary Health check
 */
export declare function useHealthCheck<TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getListPlayersUrl: (params?: ListPlayersParams) => string;
/**
 * @summary List all players
 */
export declare const listPlayers: (params?: ListPlayersParams, options?: RequestInit) => Promise<Player[]>;
export declare const getListPlayersQueryKey: (params?: ListPlayersParams) => readonly ["/api/players", ...ListPlayersParams[]];
export declare const getListPlayersQueryOptions: <TData = Awaited<ReturnType<typeof listPlayers>>, TError = ErrorType<unknown>>(params?: ListPlayersParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listPlayers>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listPlayers>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListPlayersQueryResult = NonNullable<Awaited<ReturnType<typeof listPlayers>>>;
export type ListPlayersQueryError = ErrorType<unknown>;
/**
 * @summary List all players
 */
export declare function useListPlayers<TData = Awaited<ReturnType<typeof listPlayers>>, TError = ErrorType<unknown>>(params?: ListPlayersParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listPlayers>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getCreatePlayerUrl: () => string;
/**
 * @summary Create a player
 */
export declare const createPlayer: (playerInput: PlayerInput, options?: RequestInit) => Promise<Player>;
export declare const getCreatePlayerMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createPlayer>>, TError, {
        data: BodyType<PlayerInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createPlayer>>, TError, {
    data: BodyType<PlayerInput>;
}, TContext>;
export type CreatePlayerMutationResult = NonNullable<Awaited<ReturnType<typeof createPlayer>>>;
export type CreatePlayerMutationBody = BodyType<PlayerInput>;
export type CreatePlayerMutationError = ErrorType<unknown>;
/**
* @summary Create a player
*/
export declare const useCreatePlayer: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createPlayer>>, TError, {
        data: BodyType<PlayerInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createPlayer>>, TError, {
    data: BodyType<PlayerInput>;
}, TContext>;
export declare const getImportPlayersCsvUrl: () => string;
/**
 * @summary Import players from CSV data
 */
export declare const importPlayersCsv: (csvImport: CsvImport, options?: RequestInit) => Promise<ImportResult>;
export declare const getImportPlayersCsvMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof importPlayersCsv>>, TError, {
        data: BodyType<CsvImport>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof importPlayersCsv>>, TError, {
    data: BodyType<CsvImport>;
}, TContext>;
export type ImportPlayersCsvMutationResult = NonNullable<Awaited<ReturnType<typeof importPlayersCsv>>>;
export type ImportPlayersCsvMutationBody = BodyType<CsvImport>;
export type ImportPlayersCsvMutationError = ErrorType<unknown>;
/**
* @summary Import players from CSV data
*/
export declare const useImportPlayersCsv: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof importPlayersCsv>>, TError, {
        data: BodyType<CsvImport>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof importPlayersCsv>>, TError, {
    data: BodyType<CsvImport>;
}, TContext>;
export declare const getGetPlayerStatsUrl: () => string;
/**
 * @summary Get tryout dashboard stats
 */
export declare const getPlayerStats: (options?: RequestInit) => Promise<TryoutStats>;
export declare const getGetPlayerStatsQueryKey: () => readonly ["/api/players/stats"];
export declare const getGetPlayerStatsQueryOptions: <TData = Awaited<ReturnType<typeof getPlayerStats>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getPlayerStats>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getPlayerStats>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetPlayerStatsQueryResult = NonNullable<Awaited<ReturnType<typeof getPlayerStats>>>;
export type GetPlayerStatsQueryError = ErrorType<unknown>;
/**
 * @summary Get tryout dashboard stats
 */
export declare function useGetPlayerStats<TData = Awaited<ReturnType<typeof getPlayerStats>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getPlayerStats>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetPlayerUrl: (id: number) => string;
/**
 * @summary Get a player by ID
 */
export declare const getPlayer: (id: number, options?: RequestInit) => Promise<PlayerDetail>;
export declare const getGetPlayerQueryKey: (id: number) => readonly [`/api/players/${number}`];
export declare const getGetPlayerQueryOptions: <TData = Awaited<ReturnType<typeof getPlayer>>, TError = ErrorType<void>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getPlayer>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getPlayer>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetPlayerQueryResult = NonNullable<Awaited<ReturnType<typeof getPlayer>>>;
export type GetPlayerQueryError = ErrorType<void>;
/**
 * @summary Get a player by ID
 */
export declare function useGetPlayer<TData = Awaited<ReturnType<typeof getPlayer>>, TError = ErrorType<void>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getPlayer>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getUpdatePlayerUrl: (id: number) => string;
/**
 * @summary Update a player
 */
export declare const updatePlayer: (id: number, playerUpdate: PlayerUpdate, options?: RequestInit) => Promise<Player>;
export declare const getUpdatePlayerMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updatePlayer>>, TError, {
        id: number;
        data: BodyType<PlayerUpdate>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updatePlayer>>, TError, {
    id: number;
    data: BodyType<PlayerUpdate>;
}, TContext>;
export type UpdatePlayerMutationResult = NonNullable<Awaited<ReturnType<typeof updatePlayer>>>;
export type UpdatePlayerMutationBody = BodyType<PlayerUpdate>;
export type UpdatePlayerMutationError = ErrorType<void>;
/**
* @summary Update a player
*/
export declare const useUpdatePlayer: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updatePlayer>>, TError, {
        id: number;
        data: BodyType<PlayerUpdate>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updatePlayer>>, TError, {
    id: number;
    data: BodyType<PlayerUpdate>;
}, TContext>;
export declare const getDeletePlayerUrl: (id: number) => string;
/**
 * @summary Delete a player
 */
export declare const deletePlayer: (id: number, options?: RequestInit) => Promise<void>;
export declare const getDeletePlayerMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deletePlayer>>, TError, {
        id: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof deletePlayer>>, TError, {
    id: number;
}, TContext>;
export type DeletePlayerMutationResult = NonNullable<Awaited<ReturnType<typeof deletePlayer>>>;
export type DeletePlayerMutationError = ErrorType<void>;
/**
* @summary Delete a player
*/
export declare const useDeletePlayer: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deletePlayer>>, TError, {
        id: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof deletePlayer>>, TError, {
    id: number;
}, TContext>;
export declare const getListEvaluationsUrl: (params?: ListEvaluationsParams) => string;
/**
 * @summary List evaluations
 */
export declare const listEvaluations: (params?: ListEvaluationsParams, options?: RequestInit) => Promise<Evaluation[]>;
export declare const getListEvaluationsQueryKey: (params?: ListEvaluationsParams) => readonly ["/api/evaluations", ...ListEvaluationsParams[]];
export declare const getListEvaluationsQueryOptions: <TData = Awaited<ReturnType<typeof listEvaluations>>, TError = ErrorType<unknown>>(params?: ListEvaluationsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listEvaluations>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listEvaluations>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListEvaluationsQueryResult = NonNullable<Awaited<ReturnType<typeof listEvaluations>>>;
export type ListEvaluationsQueryError = ErrorType<unknown>;
/**
 * @summary List evaluations
 */
export declare function useListEvaluations<TData = Awaited<ReturnType<typeof listEvaluations>>, TError = ErrorType<unknown>>(params?: ListEvaluationsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listEvaluations>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getUpsertEvaluationUrl: () => string;
/**
 * @summary Create or update an evaluation
 */
export declare const upsertEvaluation: (evaluationInput: EvaluationInput, options?: RequestInit) => Promise<Evaluation>;
export declare const getUpsertEvaluationMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof upsertEvaluation>>, TError, {
        data: BodyType<EvaluationInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof upsertEvaluation>>, TError, {
    data: BodyType<EvaluationInput>;
}, TContext>;
export type UpsertEvaluationMutationResult = NonNullable<Awaited<ReturnType<typeof upsertEvaluation>>>;
export type UpsertEvaluationMutationBody = BodyType<EvaluationInput>;
export type UpsertEvaluationMutationError = ErrorType<unknown>;
/**
* @summary Create or update an evaluation
*/
export declare const useUpsertEvaluation: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof upsertEvaluation>>, TError, {
        data: BodyType<EvaluationInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof upsertEvaluation>>, TError, {
    data: BodyType<EvaluationInput>;
}, TContext>;
export declare const getUpdateEvaluationUrl: (id: number) => string;
/**
 * @summary Update an evaluation
 */
export declare const updateEvaluation: (id: number, evaluationUpdate: EvaluationUpdate, options?: RequestInit) => Promise<Evaluation>;
export declare const getUpdateEvaluationMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateEvaluation>>, TError, {
        id: number;
        data: BodyType<EvaluationUpdate>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateEvaluation>>, TError, {
    id: number;
    data: BodyType<EvaluationUpdate>;
}, TContext>;
export type UpdateEvaluationMutationResult = NonNullable<Awaited<ReturnType<typeof updateEvaluation>>>;
export type UpdateEvaluationMutationBody = BodyType<EvaluationUpdate>;
export type UpdateEvaluationMutationError = ErrorType<void>;
/**
* @summary Update an evaluation
*/
export declare const useUpdateEvaluation: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateEvaluation>>, TError, {
        id: number;
        data: BodyType<EvaluationUpdate>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateEvaluation>>, TError, {
    id: number;
    data: BodyType<EvaluationUpdate>;
}, TContext>;
export declare const getListRankingsUrl: (params?: ListRankingsParams) => string;
/**
 * @summary Get all player rankings
 */
export declare const listRankings: (params?: ListRankingsParams, options?: RequestInit) => Promise<RankedPlayer[]>;
export declare const getListRankingsQueryKey: (params?: ListRankingsParams) => readonly ["/api/rankings", ...ListRankingsParams[]];
export declare const getListRankingsQueryOptions: <TData = Awaited<ReturnType<typeof listRankings>>, TError = ErrorType<unknown>>(params?: ListRankingsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listRankings>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listRankings>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListRankingsQueryResult = NonNullable<Awaited<ReturnType<typeof listRankings>>>;
export type ListRankingsQueryError = ErrorType<unknown>;
/**
 * @summary Get all player rankings
 */
export declare function useListRankings<TData = Awaited<ReturnType<typeof listRankings>>, TError = ErrorType<unknown>>(params?: ListRankingsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listRankings>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getOverrideRankingUrl: (playerId: number) => string;
/**
 * @summary Override a player's ranking position
 */
export declare const overrideRanking: (playerId: number, rankingOverride: RankingOverride, options?: RequestInit) => Promise<RankedPlayer>;
export declare const getOverrideRankingMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof overrideRanking>>, TError, {
        playerId: number;
        data: BodyType<RankingOverride>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof overrideRanking>>, TError, {
    playerId: number;
    data: BodyType<RankingOverride>;
}, TContext>;
export type OverrideRankingMutationResult = NonNullable<Awaited<ReturnType<typeof overrideRanking>>>;
export type OverrideRankingMutationBody = BodyType<RankingOverride>;
export type OverrideRankingMutationError = ErrorType<void>;
/**
* @summary Override a player's ranking position
*/
export declare const useOverrideRanking: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof overrideRanking>>, TError, {
        playerId: number;
        data: BodyType<RankingOverride>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof overrideRanking>>, TError, {
    playerId: number;
    data: BodyType<RankingOverride>;
}, TContext>;
export declare const getListRostersUrl: () => string;
/**
 * @summary List all rosters
 */
export declare const listRosters: (options?: RequestInit) => Promise<Roster[]>;
export declare const getListRostersQueryKey: () => readonly ["/api/rosters"];
export declare const getListRostersQueryOptions: <TData = Awaited<ReturnType<typeof listRosters>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listRosters>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listRosters>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListRostersQueryResult = NonNullable<Awaited<ReturnType<typeof listRosters>>>;
export type ListRostersQueryError = ErrorType<unknown>;
/**
 * @summary List all rosters
 */
export declare function useListRosters<TData = Awaited<ReturnType<typeof listRosters>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listRosters>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getCreateRosterUrl: () => string;
/**
 * @summary Create a roster
 */
export declare const createRoster: (rosterInput: RosterInput, options?: RequestInit) => Promise<Roster>;
export declare const getCreateRosterMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createRoster>>, TError, {
        data: BodyType<RosterInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createRoster>>, TError, {
    data: BodyType<RosterInput>;
}, TContext>;
export type CreateRosterMutationResult = NonNullable<Awaited<ReturnType<typeof createRoster>>>;
export type CreateRosterMutationBody = BodyType<RosterInput>;
export type CreateRosterMutationError = ErrorType<unknown>;
/**
* @summary Create a roster
*/
export declare const useCreateRoster: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createRoster>>, TError, {
        data: BodyType<RosterInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createRoster>>, TError, {
    data: BodyType<RosterInput>;
}, TContext>;
export declare const getSuggestRosterUrl: () => string;
/**
 * @summary Get suggested 12-player roster
 */
export declare const suggestRoster: (options?: RequestInit) => Promise<RosterSuggestion>;
export declare const getSuggestRosterQueryKey: () => readonly ["/api/rosters/suggest"];
export declare const getSuggestRosterQueryOptions: <TData = Awaited<ReturnType<typeof suggestRoster>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof suggestRoster>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof suggestRoster>>, TError, TData> & {
    queryKey: QueryKey;
};
export type SuggestRosterQueryResult = NonNullable<Awaited<ReturnType<typeof suggestRoster>>>;
export type SuggestRosterQueryError = ErrorType<unknown>;
/**
 * @summary Get suggested 12-player roster
 */
export declare function useSuggestRoster<TData = Awaited<ReturnType<typeof suggestRoster>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof suggestRoster>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetRosterUrl: (id: number) => string;
/**
 * @summary Get a roster by ID
 */
export declare const getRoster: (id: number, options?: RequestInit) => Promise<RosterDetail>;
export declare const getGetRosterQueryKey: (id: number) => readonly [`/api/rosters/${number}`];
export declare const getGetRosterQueryOptions: <TData = Awaited<ReturnType<typeof getRoster>>, TError = ErrorType<void>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getRoster>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getRoster>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetRosterQueryResult = NonNullable<Awaited<ReturnType<typeof getRoster>>>;
export type GetRosterQueryError = ErrorType<void>;
/**
 * @summary Get a roster by ID
 */
export declare function useGetRoster<TData = Awaited<ReturnType<typeof getRoster>>, TError = ErrorType<void>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getRoster>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getUpdateRosterUrl: (id: number) => string;
/**
 * @summary Update roster metadata
 */
export declare const updateRoster: (id: number, rosterUpdate: RosterUpdate, options?: RequestInit) => Promise<Roster>;
export declare const getUpdateRosterMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateRoster>>, TError, {
        id: number;
        data: BodyType<RosterUpdate>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateRoster>>, TError, {
    id: number;
    data: BodyType<RosterUpdate>;
}, TContext>;
export type UpdateRosterMutationResult = NonNullable<Awaited<ReturnType<typeof updateRoster>>>;
export type UpdateRosterMutationBody = BodyType<RosterUpdate>;
export type UpdateRosterMutationError = ErrorType<void>;
/**
* @summary Update roster metadata
*/
export declare const useUpdateRoster: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateRoster>>, TError, {
        id: number;
        data: BodyType<RosterUpdate>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateRoster>>, TError, {
    id: number;
    data: BodyType<RosterUpdate>;
}, TContext>;
export declare const getAddPlayerToRosterUrl: (id: number) => string;
/**
 * @summary Add a player to a roster
 */
export declare const addPlayerToRoster: (id: number, rosterPlayerInput: RosterPlayerInput, options?: RequestInit) => Promise<RosterDetail>;
export declare const getAddPlayerToRosterMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof addPlayerToRoster>>, TError, {
        id: number;
        data: BodyType<RosterPlayerInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof addPlayerToRoster>>, TError, {
    id: number;
    data: BodyType<RosterPlayerInput>;
}, TContext>;
export type AddPlayerToRosterMutationResult = NonNullable<Awaited<ReturnType<typeof addPlayerToRoster>>>;
export type AddPlayerToRosterMutationBody = BodyType<RosterPlayerInput>;
export type AddPlayerToRosterMutationError = ErrorType<void>;
/**
* @summary Add a player to a roster
*/
export declare const useAddPlayerToRoster: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof addPlayerToRoster>>, TError, {
        id: number;
        data: BodyType<RosterPlayerInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof addPlayerToRoster>>, TError, {
    id: number;
    data: BodyType<RosterPlayerInput>;
}, TContext>;
export declare const getRemovePlayerFromRosterUrl: (id: number, playerId: number) => string;
/**
 * @summary Remove a player from a roster
 */
export declare const removePlayerFromRoster: (id: number, playerId: number, options?: RequestInit) => Promise<void>;
export declare const getRemovePlayerFromRosterMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof removePlayerFromRoster>>, TError, {
        id: number;
        playerId: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof removePlayerFromRoster>>, TError, {
    id: number;
    playerId: number;
}, TContext>;
export type RemovePlayerFromRosterMutationResult = NonNullable<Awaited<ReturnType<typeof removePlayerFromRoster>>>;
export type RemovePlayerFromRosterMutationError = ErrorType<void>;
/**
* @summary Remove a player from a roster
*/
export declare const useRemovePlayerFromRoster: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof removePlayerFromRoster>>, TError, {
        id: number;
        playerId: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof removePlayerFromRoster>>, TError, {
    id: number;
    playerId: number;
}, TContext>;
export declare const getListNotesUrl: (params?: ListNotesParams) => string;
/**
 * @summary List coach notes
 */
export declare const listNotes: (params?: ListNotesParams, options?: RequestInit) => Promise<CoachNote[]>;
export declare const getListNotesQueryKey: (params?: ListNotesParams) => readonly ["/api/notes", ...ListNotesParams[]];
export declare const getListNotesQueryOptions: <TData = Awaited<ReturnType<typeof listNotes>>, TError = ErrorType<unknown>>(params?: ListNotesParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listNotes>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listNotes>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListNotesQueryResult = NonNullable<Awaited<ReturnType<typeof listNotes>>>;
export type ListNotesQueryError = ErrorType<unknown>;
/**
 * @summary List coach notes
 */
export declare function useListNotes<TData = Awaited<ReturnType<typeof listNotes>>, TError = ErrorType<unknown>>(params?: ListNotesParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listNotes>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getCreateNoteUrl: () => string;
/**
 * @summary Create a coach note
 */
export declare const createNote: (noteInput: NoteInput, options?: RequestInit) => Promise<CoachNote>;
export declare const getCreateNoteMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createNote>>, TError, {
        data: BodyType<NoteInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createNote>>, TError, {
    data: BodyType<NoteInput>;
}, TContext>;
export type CreateNoteMutationResult = NonNullable<Awaited<ReturnType<typeof createNote>>>;
export type CreateNoteMutationBody = BodyType<NoteInput>;
export type CreateNoteMutationError = ErrorType<unknown>;
/**
* @summary Create a coach note
*/
export declare const useCreateNote: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createNote>>, TError, {
        data: BodyType<NoteInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createNote>>, TError, {
    data: BodyType<NoteInput>;
}, TContext>;
export declare const getListCoachesUrl: () => string;
/**
 * @summary List all coaches
 */
export declare const listCoaches: (options?: RequestInit) => Promise<Coach[]>;
export declare const getListCoachesQueryKey: () => readonly ["/api/coaches"];
export declare const getListCoachesQueryOptions: <TData = Awaited<ReturnType<typeof listCoaches>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listCoaches>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listCoaches>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListCoachesQueryResult = NonNullable<Awaited<ReturnType<typeof listCoaches>>>;
export type ListCoachesQueryError = ErrorType<unknown>;
/**
 * @summary List all coaches
 */
export declare function useListCoaches<TData = Awaited<ReturnType<typeof listCoaches>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listCoaches>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getCreateCoachUrl: () => string;
/**
 * @summary Create a coach
 */
export declare const createCoach: (newCoachBody: NewCoachBody, options?: RequestInit) => Promise<Coach>;
export declare const getCreateCoachMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createCoach>>, TError, {
        data: BodyType<NewCoachBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createCoach>>, TError, {
    data: BodyType<NewCoachBody>;
}, TContext>;
export type CreateCoachMutationResult = NonNullable<Awaited<ReturnType<typeof createCoach>>>;
export type CreateCoachMutationBody = BodyType<NewCoachBody>;
export type CreateCoachMutationError = ErrorType<unknown>;
/**
* @summary Create a coach
*/
export declare const useCreateCoach: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createCoach>>, TError, {
        data: BodyType<NewCoachBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createCoach>>, TError, {
    data: BodyType<NewCoachBody>;
}, TContext>;
export declare const getImportCoachesCsvUrl: () => string;
/**
 * @summary Import coaches from CSV
 */
export declare const importCoachesCsv: (csvImport: CsvImport, options?: RequestInit) => Promise<ImportResult>;
export declare const getImportCoachesCsvMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof importCoachesCsv>>, TError, {
        data: BodyType<CsvImport>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof importCoachesCsv>>, TError, {
    data: BodyType<CsvImport>;
}, TContext>;
export type ImportCoachesCsvMutationResult = NonNullable<Awaited<ReturnType<typeof importCoachesCsv>>>;
export type ImportCoachesCsvMutationBody = BodyType<CsvImport>;
export type ImportCoachesCsvMutationError = ErrorType<unknown>;
/**
* @summary Import coaches from CSV
*/
export declare const useImportCoachesCsv: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof importCoachesCsv>>, TError, {
        data: BodyType<CsvImport>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof importCoachesCsv>>, TError, {
    data: BodyType<CsvImport>;
}, TContext>;
export declare const getGetAllDraftPicksUrl: () => string;
/**
 * @summary Get all draft picks across all coaches
 */
export declare const getAllDraftPicks: (options?: RequestInit) => Promise<DraftPick[]>;
export declare const getGetAllDraftPicksQueryKey: () => readonly ["/api/coaches/draft/all"];
export declare const getGetAllDraftPicksQueryOptions: <TData = Awaited<ReturnType<typeof getAllDraftPicks>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getAllDraftPicks>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getAllDraftPicks>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetAllDraftPicksQueryResult = NonNullable<Awaited<ReturnType<typeof getAllDraftPicks>>>;
export type GetAllDraftPicksQueryError = ErrorType<unknown>;
/**
 * @summary Get all draft picks across all coaches
 */
export declare function useGetAllDraftPicks<TData = Awaited<ReturnType<typeof getAllDraftPicks>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getAllDraftPicks>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getDeleteCoachUrl: (id: number) => string;
/**
 * @summary Delete a coach
 */
export declare const deleteCoach: (id: number, options?: RequestInit) => Promise<void>;
export declare const getDeleteCoachMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteCoach>>, TError, {
        id: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof deleteCoach>>, TError, {
    id: number;
}, TContext>;
export type DeleteCoachMutationResult = NonNullable<Awaited<ReturnType<typeof deleteCoach>>>;
export type DeleteCoachMutationError = ErrorType<unknown>;
/**
* @summary Delete a coach
*/
export declare const useDeleteCoach: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteCoach>>, TError, {
        id: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof deleteCoach>>, TError, {
    id: number;
}, TContext>;
export declare const getGetCoachDraftUrl: (id: number) => string;
/**
 * @summary Get or create a coach's draft roster
 */
export declare const getCoachDraft: (id: number, options?: RequestInit) => Promise<CoachDraft>;
export declare const getGetCoachDraftQueryKey: (id: number) => readonly [`/api/coaches/${number}/draft`];
export declare const getGetCoachDraftQueryOptions: <TData = Awaited<ReturnType<typeof getCoachDraft>>, TError = ErrorType<unknown>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getCoachDraft>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getCoachDraft>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetCoachDraftQueryResult = NonNullable<Awaited<ReturnType<typeof getCoachDraft>>>;
export type GetCoachDraftQueryError = ErrorType<unknown>;
/**
 * @summary Get or create a coach's draft roster
 */
export declare function useGetCoachDraft<TData = Awaited<ReturnType<typeof getCoachDraft>>, TError = ErrorType<unknown>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getCoachDraft>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getAddPlayerToDraftUrl: (id: number) => string;
/**
 * @summary Add a player to a coach's draft
 */
export declare const addPlayerToDraft: (id: number, draftPlayerBody: DraftPlayerBody, options?: RequestInit) => Promise<void>;
export declare const getAddPlayerToDraftMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof addPlayerToDraft>>, TError, {
        id: number;
        data: BodyType<DraftPlayerBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof addPlayerToDraft>>, TError, {
    id: number;
    data: BodyType<DraftPlayerBody>;
}, TContext>;
export type AddPlayerToDraftMutationResult = NonNullable<Awaited<ReturnType<typeof addPlayerToDraft>>>;
export type AddPlayerToDraftMutationBody = BodyType<DraftPlayerBody>;
export type AddPlayerToDraftMutationError = ErrorType<unknown>;
/**
* @summary Add a player to a coach's draft
*/
export declare const useAddPlayerToDraft: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof addPlayerToDraft>>, TError, {
        id: number;
        data: BodyType<DraftPlayerBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof addPlayerToDraft>>, TError, {
    id: number;
    data: BodyType<DraftPlayerBody>;
}, TContext>;
export declare const getRemovePlayerFromDraftUrl: (id: number, playerId: number) => string;
/**
 * @summary Remove a player from a coach's draft
 */
export declare const removePlayerFromDraft: (id: number, playerId: number, options?: RequestInit) => Promise<void>;
export declare const getRemovePlayerFromDraftMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof removePlayerFromDraft>>, TError, {
        id: number;
        playerId: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof removePlayerFromDraft>>, TError, {
    id: number;
    playerId: number;
}, TContext>;
export type RemovePlayerFromDraftMutationResult = NonNullable<Awaited<ReturnType<typeof removePlayerFromDraft>>>;
export type RemovePlayerFromDraftMutationError = ErrorType<unknown>;
/**
* @summary Remove a player from a coach's draft
*/
export declare const useRemovePlayerFromDraft: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof removePlayerFromDraft>>, TError, {
        id: number;
        playerId: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof removePlayerFromDraft>>, TError, {
    id: number;
    playerId: number;
}, TContext>;
export declare const getTogglePlayerLockUrl: (id: number, playerId: number) => string;
/**
 * @summary Toggle lock status of a player on a coach's draft
 */
export declare const togglePlayerLock: (id: number, playerId: number, playerLockInput: PlayerLockInput, options?: RequestInit) => Promise<void>;
export declare const getTogglePlayerLockMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof togglePlayerLock>>, TError, {
        id: number;
        playerId: number;
        data: BodyType<PlayerLockInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof togglePlayerLock>>, TError, {
    id: number;
    playerId: number;
    data: BodyType<PlayerLockInput>;
}, TContext>;
export type TogglePlayerLockMutationResult = NonNullable<Awaited<ReturnType<typeof togglePlayerLock>>>;
export type TogglePlayerLockMutationBody = BodyType<PlayerLockInput>;
export type TogglePlayerLockMutationError = ErrorType<unknown>;
/**
* @summary Toggle lock status of a player on a coach's draft
*/
export declare const useTogglePlayerLock: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof togglePlayerLock>>, TError, {
        id: number;
        playerId: number;
        data: BodyType<PlayerLockInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof togglePlayerLock>>, TError, {
    id: number;
    playerId: number;
    data: BodyType<PlayerLockInput>;
}, TContext>;
export declare const getCommitDraftPlayerUrl: (id: number, playerId: number) => string;
/**
 * @summary Mark a player as committed to a coach's draft
 */
export declare const commitDraftPlayer: (id: number, playerId: number, options?: RequestInit) => Promise<void>;
export declare const getCommitDraftPlayerMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof commitDraftPlayer>>, TError, {
        id: number;
        playerId: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof commitDraftPlayer>>, TError, {
    id: number;
    playerId: number;
}, TContext>;
export type CommitDraftPlayerMutationResult = NonNullable<Awaited<ReturnType<typeof commitDraftPlayer>>>;
export type CommitDraftPlayerMutationError = ErrorType<void>;
/**
* @summary Mark a player as committed to a coach's draft
*/
export declare const useCommitDraftPlayer: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof commitDraftPlayer>>, TError, {
        id: number;
        playerId: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof commitDraftPlayer>>, TError, {
    id: number;
    playerId: number;
}, TContext>;
export declare const getGetAllWishlistPicksUrl: () => string;
/**
 * @summary Get all wishlist picks across all coaches
 */
export declare const getAllWishlistPicks: (options?: RequestInit) => Promise<WishlistPick[]>;
export declare const getGetAllWishlistPicksQueryKey: () => readonly ["/api/coaches/wishlist/all"];
export declare const getGetAllWishlistPicksQueryOptions: <TData = Awaited<ReturnType<typeof getAllWishlistPicks>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getAllWishlistPicks>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getAllWishlistPicks>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetAllWishlistPicksQueryResult = NonNullable<Awaited<ReturnType<typeof getAllWishlistPicks>>>;
export type GetAllWishlistPicksQueryError = ErrorType<unknown>;
/**
 * @summary Get all wishlist picks across all coaches
 */
export declare function useGetAllWishlistPicks<TData = Awaited<ReturnType<typeof getAllWishlistPicks>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getAllWishlistPicks>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetCoachWishlistUrl: (id: number) => string;
/**
 * @summary Get a coach's wishlist
 */
export declare const getCoachWishlist: (id: number, options?: RequestInit) => Promise<number[]>;
export declare const getGetCoachWishlistQueryKey: (id: number) => readonly [`/api/coaches/${number}/wishlist`];
export declare const getGetCoachWishlistQueryOptions: <TData = Awaited<ReturnType<typeof getCoachWishlist>>, TError = ErrorType<unknown>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getCoachWishlist>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getCoachWishlist>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetCoachWishlistQueryResult = NonNullable<Awaited<ReturnType<typeof getCoachWishlist>>>;
export type GetCoachWishlistQueryError = ErrorType<unknown>;
/**
 * @summary Get a coach's wishlist
 */
export declare function useGetCoachWishlist<TData = Awaited<ReturnType<typeof getCoachWishlist>>, TError = ErrorType<unknown>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getCoachWishlist>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getAddToWishlistUrl: (id: number) => string;
/**
 * @summary Add a player to a coach's wishlist
 */
export declare const addToWishlist: (id: number, wishlistInput: WishlistInput, options?: RequestInit) => Promise<void>;
export declare const getAddToWishlistMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof addToWishlist>>, TError, {
        id: number;
        data: BodyType<WishlistInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof addToWishlist>>, TError, {
    id: number;
    data: BodyType<WishlistInput>;
}, TContext>;
export type AddToWishlistMutationResult = NonNullable<Awaited<ReturnType<typeof addToWishlist>>>;
export type AddToWishlistMutationBody = BodyType<WishlistInput>;
export type AddToWishlistMutationError = ErrorType<unknown>;
/**
* @summary Add a player to a coach's wishlist
*/
export declare const useAddToWishlist: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof addToWishlist>>, TError, {
        id: number;
        data: BodyType<WishlistInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof addToWishlist>>, TError, {
    id: number;
    data: BodyType<WishlistInput>;
}, TContext>;
export declare const getRemoveFromWishlistUrl: (id: number, playerId: number) => string;
/**
 * @summary Remove a player from a coach's wishlist
 */
export declare const removeFromWishlist: (id: number, playerId: number, options?: RequestInit) => Promise<void>;
export declare const getRemoveFromWishlistMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof removeFromWishlist>>, TError, {
        id: number;
        playerId: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof removeFromWishlist>>, TError, {
    id: number;
    playerId: number;
}, TContext>;
export type RemoveFromWishlistMutationResult = NonNullable<Awaited<ReturnType<typeof removeFromWishlist>>>;
export type RemoveFromWishlistMutationError = ErrorType<unknown>;
/**
* @summary Remove a player from a coach's wishlist
*/
export declare const useRemoveFromWishlist: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof removeFromWishlist>>, TError, {
        id: number;
        playerId: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof removeFromWishlist>>, TError, {
    id: number;
    playerId: number;
}, TContext>;
export declare const getGetAllMustHavePicksUrl: () => string;
/**
 * @summary Get all must-have picks across all coaches
 */
export declare const getAllMustHavePicks: (options?: RequestInit) => Promise<MustHavePick[]>;
export declare const getGetAllMustHavePicksQueryKey: () => readonly ["/api/coaches/musthave/all"];
export declare const getGetAllMustHavePicksQueryOptions: <TData = Awaited<ReturnType<typeof getAllMustHavePicks>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getAllMustHavePicks>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getAllMustHavePicks>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetAllMustHavePicksQueryResult = NonNullable<Awaited<ReturnType<typeof getAllMustHavePicks>>>;
export type GetAllMustHavePicksQueryError = ErrorType<unknown>;
/**
 * @summary Get all must-have picks across all coaches
 */
export declare function useGetAllMustHavePicks<TData = Awaited<ReturnType<typeof getAllMustHavePicks>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getAllMustHavePicks>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetCoachMustHaveUrl: (id: number) => string;
/**
 * @summary Get a coach's must-have list
 */
export declare const getCoachMustHave: (id: number, options?: RequestInit) => Promise<number[]>;
export declare const getGetCoachMustHaveQueryKey: (id: number) => readonly [`/api/coaches/${number}/musthave`];
export declare const getGetCoachMustHaveQueryOptions: <TData = Awaited<ReturnType<typeof getCoachMustHave>>, TError = ErrorType<unknown>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getCoachMustHave>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getCoachMustHave>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetCoachMustHaveQueryResult = NonNullable<Awaited<ReturnType<typeof getCoachMustHave>>>;
export type GetCoachMustHaveQueryError = ErrorType<unknown>;
/**
 * @summary Get a coach's must-have list
 */
export declare function useGetCoachMustHave<TData = Awaited<ReturnType<typeof getCoachMustHave>>, TError = ErrorType<unknown>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getCoachMustHave>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getAddToMustHaveUrl: (id: number) => string;
/**
 * @summary Add a player to a coach's must-have list
 */
export declare const addToMustHave: (id: number, mustHaveInput: MustHaveInput, options?: RequestInit) => Promise<void>;
export declare const getAddToMustHaveMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof addToMustHave>>, TError, {
        id: number;
        data: BodyType<MustHaveInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof addToMustHave>>, TError, {
    id: number;
    data: BodyType<MustHaveInput>;
}, TContext>;
export type AddToMustHaveMutationResult = NonNullable<Awaited<ReturnType<typeof addToMustHave>>>;
export type AddToMustHaveMutationBody = BodyType<MustHaveInput>;
export type AddToMustHaveMutationError = ErrorType<unknown>;
/**
* @summary Add a player to a coach's must-have list
*/
export declare const useAddToMustHave: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof addToMustHave>>, TError, {
        id: number;
        data: BodyType<MustHaveInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof addToMustHave>>, TError, {
    id: number;
    data: BodyType<MustHaveInput>;
}, TContext>;
export declare const getRemoveFromMustHaveUrl: (id: number, playerId: number) => string;
/**
 * @summary Remove a player from a coach's must-have list
 */
export declare const removeFromMustHave: (id: number, playerId: number, options?: RequestInit) => Promise<void>;
export declare const getRemoveFromMustHaveMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof removeFromMustHave>>, TError, {
        id: number;
        playerId: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof removeFromMustHave>>, TError, {
    id: number;
    playerId: number;
}, TContext>;
export type RemoveFromMustHaveMutationResult = NonNullable<Awaited<ReturnType<typeof removeFromMustHave>>>;
export type RemoveFromMustHaveMutationError = ErrorType<unknown>;
/**
* @summary Remove a player from a coach's must-have list
*/
export declare const useRemoveFromMustHave: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof removeFromMustHave>>, TError, {
        id: number;
        playerId: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof removeFromMustHave>>, TError, {
    id: number;
    playerId: number;
}, TContext>;
export declare const getUpdateNoteUrl: (id: number) => string;
/**
 * @summary Update a coach note
 */
export declare const updateNote: (id: number, noteUpdate: NoteUpdate, options?: RequestInit) => Promise<CoachNote>;
export declare const getUpdateNoteMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateNote>>, TError, {
        id: number;
        data: BodyType<NoteUpdate>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateNote>>, TError, {
    id: number;
    data: BodyType<NoteUpdate>;
}, TContext>;
export type UpdateNoteMutationResult = NonNullable<Awaited<ReturnType<typeof updateNote>>>;
export type UpdateNoteMutationBody = BodyType<NoteUpdate>;
export type UpdateNoteMutationError = ErrorType<void>;
/**
* @summary Update a coach note
*/
export declare const useUpdateNote: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateNote>>, TError, {
        id: number;
        data: BodyType<NoteUpdate>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateNote>>, TError, {
    id: number;
    data: BodyType<NoteUpdate>;
}, TContext>;
export declare const getDeleteNoteUrl: (id: number) => string;
/**
 * @summary Delete a coach note
 */
export declare const deleteNote: (id: number, options?: RequestInit) => Promise<void>;
export declare const getDeleteNoteMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteNote>>, TError, {
        id: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof deleteNote>>, TError, {
    id: number;
}, TContext>;
export type DeleteNoteMutationResult = NonNullable<Awaited<ReturnType<typeof deleteNote>>>;
export type DeleteNoteMutationError = ErrorType<void>;
/**
* @summary Delete a coach note
*/
export declare const useDeleteNote: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteNote>>, TError, {
        id: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof deleteNote>>, TError, {
    id: number;
}, TContext>;
export declare const getGetSyncStatusUrl: () => string;
/**
 * @summary Get last sync status
 */
export declare const getSyncStatus: (options?: RequestInit) => Promise<SyncStatus>;
export declare const getGetSyncStatusQueryKey: () => readonly ["/api/sync/status"];
export declare const getGetSyncStatusQueryOptions: <TData = Awaited<ReturnType<typeof getSyncStatus>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getSyncStatus>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getSyncStatus>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetSyncStatusQueryResult = NonNullable<Awaited<ReturnType<typeof getSyncStatus>>>;
export type GetSyncStatusQueryError = ErrorType<unknown>;
/**
 * @summary Get last sync status
 */
export declare function useGetSyncStatus<TData = Awaited<ReturnType<typeof getSyncStatus>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getSyncStatus>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getTriggerSyncUrl: () => string;
/**
 * @summary Trigger manual data sync
 */
export declare const triggerSync: (syncTrigger: SyncTrigger, options?: RequestInit) => Promise<SyncStatus>;
export declare const getTriggerSyncMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof triggerSync>>, TError, {
        data: BodyType<SyncTrigger>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof triggerSync>>, TError, {
    data: BodyType<SyncTrigger>;
}, TContext>;
export type TriggerSyncMutationResult = NonNullable<Awaited<ReturnType<typeof triggerSync>>>;
export type TriggerSyncMutationBody = BodyType<SyncTrigger>;
export type TriggerSyncMutationError = ErrorType<unknown>;
/**
* @summary Trigger manual data sync
*/
export declare const useTriggerSync: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof triggerSync>>, TError, {
        data: BodyType<SyncTrigger>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof triggerSync>>, TError, {
    data: BodyType<SyncTrigger>;
}, TContext>;
export declare const getSyncFromGoogleSheetsUrl: () => string;
/**
 * @summary Sync players from a Google Sheet
 */
export declare const syncFromGoogleSheets: (sheetsSyncRequest: SheetsSyncRequest, options?: RequestInit) => Promise<ImportResult>;
export declare const getSyncFromGoogleSheetsMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof syncFromGoogleSheets>>, TError, {
        data: BodyType<SheetsSyncRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof syncFromGoogleSheets>>, TError, {
    data: BodyType<SheetsSyncRequest>;
}, TContext>;
export type SyncFromGoogleSheetsMutationResult = NonNullable<Awaited<ReturnType<typeof syncFromGoogleSheets>>>;
export type SyncFromGoogleSheetsMutationBody = BodyType<SheetsSyncRequest>;
export type SyncFromGoogleSheetsMutationError = ErrorType<unknown>;
/**
* @summary Sync players from a Google Sheet
*/
export declare const useSyncFromGoogleSheets: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof syncFromGoogleSheets>>, TError, {
        data: BodyType<SheetsSyncRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof syncFromGoogleSheets>>, TError, {
    data: BodyType<SheetsSyncRequest>;
}, TContext>;
export declare const getGeneratePlayerSummaryUrl: (playerId: number) => string;
/**
 * @summary Generate AI summary for a player
 */
export declare const generatePlayerSummary: (playerId: number, options?: RequestInit) => Promise<AiPlayerSummary>;
export declare const getGeneratePlayerSummaryMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof generatePlayerSummary>>, TError, {
        playerId: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof generatePlayerSummary>>, TError, {
    playerId: number;
}, TContext>;
export type GeneratePlayerSummaryMutationResult = NonNullable<Awaited<ReturnType<typeof generatePlayerSummary>>>;
export type GeneratePlayerSummaryMutationError = ErrorType<void>;
/**
* @summary Generate AI summary for a player
*/
export declare const useGeneratePlayerSummary: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof generatePlayerSummary>>, TError, {
        playerId: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof generatePlayerSummary>>, TError, {
    playerId: number;
}, TContext>;
export declare const getGenerateRosterExplanationUrl: (rosterId: number) => string;
/**
 * @summary Generate AI explanation for roster decisions
 */
export declare const generateRosterExplanation: (rosterId: number, options?: RequestInit) => Promise<AiRosterExplanation>;
export declare const getGenerateRosterExplanationMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof generateRosterExplanation>>, TError, {
        rosterId: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof generateRosterExplanation>>, TError, {
    rosterId: number;
}, TContext>;
export type GenerateRosterExplanationMutationResult = NonNullable<Awaited<ReturnType<typeof generateRosterExplanation>>>;
export type GenerateRosterExplanationMutationError = ErrorType<void>;
/**
* @summary Generate AI explanation for roster decisions
*/
export declare const useGenerateRosterExplanation: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof generateRosterExplanation>>, TError, {
        rosterId: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof generateRosterExplanation>>, TError, {
    rosterId: number;
}, TContext>;
export {};
//# sourceMappingURL=api.d.ts.map