import { writable } from 'svelte/store';

interface APICall {
    route: string;
    timestamp: number;
}

interface APICounterStore {
    count: number;
    calls: APICall[];
}

function createAPICounterStore() {
    const { subscribe, update } = writable<APICounterStore>({
        count: 0,
        calls: []
    });

    return {
        subscribe,
        increment: (route: string) => {
            update(store => {
                const call = {
                    route,
                    timestamp: Date.now()
                };
                console.log(`API Call #${store.count + 1}: ${route}`);
                return {
                    count: store.count + 1,
                    calls: [...store.calls, call]
                };
            });
        },
        reset: () => {
            update(() => ({
                count: 0,
                calls: []
            }));
        }
    };
}

export const apiCounter = createAPICounterStore(); 