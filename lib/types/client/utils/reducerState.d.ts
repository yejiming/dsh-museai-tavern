export type FieldUpdater<Value> = Value | ((previous: Value) => Value);
export type StateGroupAction<State extends object> = Partial<State> | ((state: State) => State);
export declare function useStateGroup<State extends object>(initialState: State | (() => State)): readonly [State, (action: StateGroupAction<State>) => void, <Key extends keyof State>(key: Key, value: FieldUpdater<State[Key]>) => void];
