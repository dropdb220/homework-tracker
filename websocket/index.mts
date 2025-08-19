import WebSocket, { WebSocketServer } from 'ws';
import dotenv from "dotenv";
import { MongoClient } from 'mongodb';

const NODE_ENV = process.env.NODE_ENV || "development";

dotenv.config({ path: [`.env.${NODE_ENV}.local`, `.env.${NODE_ENV}`, '.env'] });

const newClients = new Map<string, WebSocket>();
const oldClients = new Map<string, WebSocket>();
const ecdhData = new Map<string, { stage: number, data?: string, iv?: string }>();

const dbClient = new MongoClient(process.env.MONGO!);
await dbClient.connect();
const db = dbClient.db(process.env.DB_NAME);
const usersCollection = db.collection('users');
const tokensCollection = db.collection('tokens');

const wss = new WebSocketServer({ port: Number(process.env.WS_PORT) || 4000 });
wss.on('connection', (ws, req) => {
    let authenticated = false;
    let token = '';
    let id = '';
    let code = '';
    if (req.url === '/enc_setup_new') {
        ws.on('message', async data => {
            const msg = JSON.parse(data.toString());
            switch (msg.type) {
                case 'auth':
                    const session = await tokensCollection.findOne({ token: msg.token });
                    if (!session) {
                        ws.send(JSON.stringify({ type: 'unauthorized' }));
                        ws.close();
                    } else {
                        authenticated = true;
                        token = msg.token;
                        id = session.id;
                        let newCode = '';
                        do {
                            newCode = new Array(6).fill(0).map(() => Math.floor(Math.random() * 26) + 65).map(x => String.fromCharCode(x)).join('');
                        } while (newClients.has(newCode));
                        newClients.set(newCode, ws);
                        code = newCode;
                        ws.send(JSON.stringify({ type: 'code', data: { newCode } }));
                    }
                    break;
                case 'ecdh_key':
                    if (!authenticated) return;
                    oldClients.get(code)?.send(JSON.stringify({ type: 'ecdh', data: { key: msg.key } }));
                    break;
                case 'ecdh_done':
                    if (!authenticated) return;
                    ecdhData.set(code, { ...ecdhData.get(code), stage: ecdhData.get(code)!.stage + 1 });
                    if (ecdhData.get(code)!.stage === 2) {
                        ws.send(JSON.stringify({ type: 'data', data: ecdhData.get(code)!.data, iv: ecdhData.get(code)!.iv }));
                    }
                    break;
                case 'enc_data':
                    if (!authenticated) return;
                    if (!msg.data) {
                        ws.send(JSON.stringify({ type: 'error', msg: 'Invalid data' }));
                        return;
                    }
                    tokensCollection.updateOne({ token }, { $set: { encv2: msg.data } }).then(() => {
                        usersCollection.updateOne({ id }, { $set: { encv2: true }, $unset: { enc: '', salt2: '', iv: '' } }).then(() => {
                            ws.send(JSON.stringify({ type: 'complete' }));
                            oldClients.get(code)?.send(JSON.stringify({ type: 'complete' }));
                            newClients.delete(code);
                            oldClients.delete(code);
                            ecdhData.delete(code);
                        });
                    });
                    break;
            }
        });
        ws.on('close', () => {
            oldClients.get(code)?.close();
            if (newClients.has(code)) newClients.delete(code);
            if (oldClients.has(code)) oldClients.delete(code);
            if (ecdhData.has(code)) ecdhData.delete(code);
        });
        ws.send(JSON.stringify({ type: 'auth' }));
    } else if (req.url === '/enc_setup_old') {
        ws.on('message', async data => {
            const msg = JSON.parse(data.toString());
            switch (msg.type) {
                case 'auth':
                    const session = await tokensCollection.findOne({ token: msg.token });
                    if (!session) {
                        ws.send(JSON.stringify({ type: 'unauthorized' }));
                        ws.close();
                    } else if (!msg.code || !newClients.has(msg.code) || oldClients.has(msg.code)) {
                        ws.send(JSON.stringify({ type: 'error', msg: 'Invalid code' }));
                        ws.close();
                    } else {
                        authenticated = true;
                        token = msg.token;
                        id = session.id;
                        code = msg.code;
                        oldClients.set(code, ws);
                        ecdhData.set(code, { stage: 0 });
                        ws.send(JSON.stringify({ type: 'start' }));
                        newClients.get(code)?.send(JSON.stringify({ type: 'start' }));
                    }
                    break;
                case 'ecdh_key':
                    if (!authenticated) return;
                    newClients.get(code)?.send(JSON.stringify({ type: 'ecdh', data: { key: msg.key } }));
                    break;
                case 'ecdh_done':
                    if (!authenticated) return;
                    ecdhData.set(code, { ...ecdhData.get(code), stage: ecdhData.get(code)!.stage + 1, data: msg.data, iv: msg.iv });
                    if (ecdhData.get(code)!.stage === 2) {
                        newClients.get(code)?.send(JSON.stringify({ type: 'data', data: { data: ecdhData.get(code)!.data, iv: ecdhData.get(code)!.iv } }));
                    }
                    break;
            }
        });
        ws.on('close', () => {
            newClients.get(code)?.close();
            if (newClients.has(code)) newClients.delete(code);
            if (oldClients.has(code)) oldClients.delete(code);
            if (ecdhData.has(code)) ecdhData.delete(code);
        });
        ws.send(JSON.stringify({ type: 'auth' }));
    }
});