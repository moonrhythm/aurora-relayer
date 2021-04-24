/* This is free and unencumbered software released into the public domain. */

import { ConnectEnv, NetworkConfig, NETWORKS } from '@aurora-is-near/engine';

export interface Config {
    debug: boolean;
    verbose: boolean;
    database: string;
    port: number | string;
    network: string;
    endpoint?: string;
    engine: string;
    signer: string;
    blacklist: {ipv4?: string[], ipv6?: string[]};
}

export function parseConfig(options: Config, config: Config, env: ConnectEnv): [NetworkConfig, Config] {
    const networkID = options.network || env.NEAR_ENV || config.network;
    const network = NETWORKS.get(networkID)!; // TODO: error handling
    const debug = options.debug || config.debug;
    return [network, {
        debug: debug,
        verbose: debug || options.verbose || config.verbose,
        database: options.database || config.database,
        port: parseInt(options.port as string || config.port as string),
        network: networkID,
        endpoint: options.endpoint || env.NEAR_URL || config.endpoint || network.nearEndpoint,
        engine: options.engine || env.AURORA_ENGINE || config.engine || network.contractID,
        signer: options.signer || env.NEAR_MASTER_ACCOUNT || config.signer,
        blacklist: config.blacklist || {},
    }];
}