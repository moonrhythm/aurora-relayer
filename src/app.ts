/* This is free and unencumbered software released into the public domain. */

import { validateEIP712, encodeMetaCall } from './eip-712-helpers.js';
import { CodedError } from './errors.js';
import { requestID } from './middleware.js';
import { Server } from './server.js';

import { Engine } from '@aurora-is-near/engine';
import bodyParser from 'body-parser';
import connect from 'connect';
import cors from 'cors';
import express from 'express';
import pino from 'express-pino-logger';
import expressRateLimit from 'express-rate-limit';
import helmet from 'helmet';
import jayson from 'jayson';
import nearProvider from 'near-web3-provider';
//import { exit } from 'process';

interface NearProvider {
    networkId: string;
    evm_contract: string;
    isReadOnly: boolean;
    url: string;
    version: string;
    nearProvider: any;
    keyStore: any;
    signer: any;
    connection: any;
    accountId: string;
    account: any;
    accountEvmAddress: string;
    accounts: Map<string, any>;
    walletUrl: string;
    explorerUrl: string;
}

function response(id: string, result: any, error: any) {
    const resp = { jsonrpc: '2.0', id };
    if (error) {
        Object.assign(resp, { error });
    } else {
        Object.assign(resp, { result });
    }
    return resp;
}

export async function createApp(options: any, engine: Engine, provider: NearProvider): Promise<any> {
    const app = express();
    app.disable('x-powered-by');
    app.use(bodyParser.json({ type: 'application/json' }));
    app.use(cors());
    app.use(helmet.noSniff()); // X-Content-Type-Options: nosniff
    app.use(requestID());
    app.use(expressRateLimit({
        windowMs: 60 * 1000, // 1 minute
        max: 60,
        headers: false,
        draft_polli_ratelimit_headers: true,
        handler: (req, res) => {
            res.status(429)
                .set('Content-Type', 'text/plain')
                .send("Too many requests, please try again later.");
        },
    }));
    app.use(pino());

    app.use(createServer(options, engine, provider));

    app.post('/relay', async (req, res) => {
        res.header('Content-Type', 'application/json');
        const data = req.body;
        if (!data.data || !data.signature || !validateEIP712(data.data, data.signature)) {
            res.send({ code: -32000, message: "Signature is invalid for given message" });
            return;
        }
        try {
            const result = await nearProvider.utils.rawFunctionCall(
                provider.account,
                provider.evm_contract,
                'meta_call',
                encodeMetaCall(data.data, data.signature),
                '10000000000000',
                '0'
            );
            if (options.verbose) {
                console.log(data.data, data.signature);
                console.log(result);
            }
            res.send(response(data.id, result, null));
        } catch (error) {
            res.send(response(data.id, null, {
                code: -32000,
                message: error.message,
            }));
        }
    });

    return app;
}

class Method extends jayson.Method {
    public readonly server;

    constructor(
        public handler?: jayson.MethodHandlerType,
        options?: jayson.MethodOptions) {
            super(handler, {});
            this.server = options?.useContext as any; // HACK
        }

    getHandler(): jayson.MethodHandlerType {
        return this.handler!;
    }

    setHandler(handler: jayson.MethodHandlerType) {
        this.handler = handler;
    }

    execute(server: jayson.Server, requestParams: jayson.RequestParamsLike, _context: any, callback: jayson.JSONRPCCallbackType): any {
        const args = (requestParams || []) as any[];
        const result: Promise<any> = (this.handler as any).call(this.server, ...args);
        result
            .then((value: any) => (callback as any)(undefined, value))
            .catch((error: any) => {
                console.error(error);
                const errorCode = (error instanceof CodedError) ? error.code : -32000;
                return (callback as any)(server.error(errorCode, error.message));
            });
        return null;
    }
}

interface MethodMap { [methodName: string]: jayson.MethodLike }

function createServer(options: any, engine: Engine, provider: NearProvider): connect.HandleFunction {
    const server = new Server(engine, provider, options);
    const methodList = Object.getOwnPropertyNames(Server.prototype)
        .filter((id: string) => id !== 'constructor')
        .map((id: string) => [id, (server as any)[id]]);
    const methodMap: MethodMap = Object.fromEntries(methodList);
    const jaysonServer = new jayson.Server(methodMap, { methodConstructor: Method, useContext: server as any });
    return jaysonServer.middleware();
}
