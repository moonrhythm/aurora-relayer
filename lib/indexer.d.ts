import { Config } from './config.js';
import { BlockHeight, ConnectEnv, Engine, NetworkConfig, Transaction } from '@aurora-is-near/engine';
import pg from 'pg';
import { Logger } from 'pino';
export declare class Indexer {
    readonly config: Config;
    readonly network: NetworkConfig;
    readonly logger: Logger;
    readonly engine: Engine;
    protected readonly pgClient: pg.Client;
    protected blockID: number;
    constructor(config: Config, network: NetworkConfig, logger: Logger, engine: Engine);
    start(): Promise<void>;
    indexBlock(blockID: BlockHeight): Promise<void>;
    indexTransaction(blockID: BlockHeight, transactionIndex: number, transaction: Transaction): Promise<void>;
}
declare global {
    namespace NodeJS {
        interface ProcessEnv extends ConnectEnv {
        }
    }
}