import { MongoClient } from "mongodb";
import { sendNotification, setVapidDetails } from "web-push";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) {
        return new Response(JSON.stringify({ code: 1, msg: 'ID를 입력하세요.' }), { status: 400 });
    }

    const client = new MongoClient(process.env.MONGO!);
    await client.connect();
    const db = client.db(process.env.DB_NAME);
    const collection = db.collection('users');
    const user = await collection.findOne({ id });
    if (!user) {
        return new Response(JSON.stringify({ code: 1, msg: '입력한 ID는 존재하지 않습니다.' }), { status: 404 });
    } else {
        return new Response(JSON.stringify({
            code: 0, data: {
                id: user.id,
                firstName: user.firstName,
                lastName: user.lastName,
                perm: user.perm,
                accepted: user.accepted,
                allergy: user.allergy,
                answerer: user.answerer,
                lang: user.lang
            }
        }), { status: 200 });
    }
}

export async function POST(request: Request) {
    const { id, pwd: rawPwd } = await request.json();
    if (!id || !rawPwd) {
        return new Response(JSON.stringify({ code: 1, msg: 'ID와 비밀번호를 입력하세요.' }), { status: 400 });
    }
    if (typeof id !== 'string' || typeof rawPwd !== 'string') {
        return new Response(JSON.stringify({ code: 1, msg: '입력한 정보가 올바르지 않습니다.' }), { status: 400 });
    }
    if (id.length < 4 || id.length > 20) {
        return new Response(JSON.stringify({ code: 1, msg: 'ID는 4자 이상 20자 이하로 입력하세요.' }), { status: 400 });
    }
    if (rawPwd.length < 8 || rawPwd.length > 4096) {
        return new Response(JSON.stringify({ code: 1, msg: '비밀번호는 8자 이상 4096자 이하로 입력하세요.' }), { status: 400 });
    }
    let salt = '';
    for (let i = 0; i < 64; i++) {
        salt += String.fromCharCode(Math.floor(Math.random() * 95) + 32);
    }
    const firstHash = await globalThis.crypto.subtle.digest('SHA-512', new TextEncoder().encode(rawPwd + salt));
    const secondHash = await globalThis.crypto.subtle.digest('SHA-512', new TextEncoder().encode(Array.from(new Uint8Array(firstHash)).map((b) => b.toString(16).padStart(2, "0")).join("") + salt));
    const shaHash = Array.from(new Uint8Array(secondHash)).map((b) => b.toString(16).padStart(2, "0")).join("");
    const pbkdf2Key = await globalThis.crypto.subtle.importKey('raw', new TextEncoder().encode(shaHash), 'PBKDF2', false, ['deriveBits']);
    const rawHash = await globalThis.crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 1000000, hash: 'SHA-512' }, pbkdf2Key, 512);
    const hash = Array.prototype.map.call(new Uint8Array(rawHash), x => x.toString(16).padStart(2, '0')).join('');

    const client = new MongoClient(process.env.MONGO!);
    await client.connect();
    const db = client.db(process.env.DB_NAME);
    const usersCollection = db.collection('users');
    const user = await usersCollection.findOne({ id });
    if (user) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: '이미 존재하는 ID입니다.' }), { status: 400 });
    }
    await usersCollection.insertOne({ id, pwd: hash, salt, firstName: '', lastName: '', perm: 2, accepted: false, passkeys: [], subscriptions: [], allergy: [], answerer: false, lang: 0 });
    let token = '';
    for (let i = 0; i < 64; i++) {
        token += Math.floor(Math.random() * 16).toString(16);
    }
    const tokenCollection = db.collection('tokens');
    await tokenCollection.insertOne({ id, token });
    const userList = await usersCollection.find({ $and: [{ id: { $ne: id } }, { perm: { $lt: 2 } }] }).toArray();
    setVapidDetails(`mailto:${process.env.VAPID_EMAIL!}`, process.env.NEXT_PUBLIC_VAPID_PUBKEY!, process.env.VAPID_PRIVKEY!);
    userList.forEach(user => {
        user.subscriptions.forEach(async (sub: any) => {
            sendNotification(sub, JSON.stringify([{
                title: user.lang == 1 ? 'Account Created' : `계정 생성됨`,
                body: user.lang == 1 ? `A new account with ID ${id} was created just now.` : `${id} 계정이 생성되었습니다.`,
                tag: id
            }])).catch(() => { });
        });
    });
    client.close();
    return new Response(JSON.stringify({ code: 0, id, token }), { status: 200 });
}

export async function PUT(request: Request) {
    const { id, pwd, firstName, lastName, perm, accepted, allergy, answerer, lang } = await request.json();
    const token = request.headers.get('Authorization');
    if (!token) {
        return new Response(JSON.stringify({ code: 1, msg: '로그인이 필요합니다.' }), { status: 401 });
    }

    const client = new MongoClient(process.env.MONGO!);
    await client.connect();
    const db = client.db(process.env.DB_NAME);
    const tokenCollection = db.collection('tokens');
    const tokenToUser = await tokenCollection.findOne({ token });
    if (!tokenToUser) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: '로그인 상태가 아닙니다.' }), { status: 401 });
    }
    if (typeof id !== 'string') {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: '입력한 정보가 올바르지 않습니다.' }), { status: 400 });
    }

    const usersCollection = db.collection('users');
    const loginedUser = await usersCollection.findOne({ id: tokenToUser.id });
    switch (loginedUser!.perm) {
        case 0:
            break;
        case 1:
            if (loginedUser!.id === id) {
                if (perm != null || firstName != null || lastName != null || accepted != null || answerer != null) {
                    client.close();
                    return new Response(JSON.stringify({ code: 1, msg: '이름, 승인 여부, 권한, 또는 질문 답변자 여부를 수정하려면 root 권한이 필요합니다.' }), { status: 403 });
                }
            } else {
                if (perm != null || pwd != null || allergy != null || answerer != null) {
                    client.close();
                    return new Response(JSON.stringify({ code: 1, msg: '권한, 비밀번호, 알러지 정보, 또는 질문 답변자 여부를 수정하려면 root 권한이 필요합니다.' }), { status: 403 });
                }
            }
            break;
        case 2:
            if (loginedUser!.id === id) {
                if (perm != null || firstName != null || lastName != null || accepted != null || answerer != null) {
                    client.close();
                    return new Response(JSON.stringify({ code: 1, msg: '이름, 승인 여부, 권한, 또는 질문 답변자 여부를 수정하려면 root 권한이 필요합니다.' }), { status: 403 });
                }
            } else {
                client.close();
                return new Response(JSON.stringify({ code: 1, msg: '다른 사용자의 정보를 수정하려면 root 권한이 필요합니다.' }), { status: 403 });
            }
            break;
        default:
            client.close();
            return new Response(JSON.stringify({ code: 1, msg: '알 수 없는 오류가 발생했습니다.' }), { status: 500 });
    }

    const user = await usersCollection.findOne({ id });
    if (!user) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: '입력한 ID가 존재하지 않습니다.' }), { status: 400 });
    } else {
        if (loginedUser!.perm !== 0 && id !== loginedUser!.id && user.perm < 2) {
            client.close();
            return new Response(JSON.stringify({ code: 1, msg: '관리자 이상의 권한을 가진 사용자의 정보를 수정하려면 root 권한이 필요합니다.' }), { status: 403 });
        }
        if ((pwd && typeof pwd !== 'string') || (firstName && typeof firstName !== 'string') || (lastName && typeof lastName !== 'string') || (perm != null && typeof perm !== 'number') || (accepted != null && typeof accepted !== 'boolean') || (allergy && !Array.isArray(allergy)) || (answerer != null && typeof answerer !== 'boolean')) {
            client.close();
            return new Response(JSON.stringify({ code: 1, msg: '입력한 정보가 올바르지 않습니다.' }), { status: 400 });
        }
        const updateList = { $set: {} };
        if (pwd) {
            if (pwd.length < 8 || pwd.length > 4096) {
                client.close();
                return new Response(JSON.stringify({ code: 1, msg: '비밀번호는 8자 이상 4096자 이하로 입력하세요.' }), { status: 400 });
            }
            let salt = '';
            for (let i = 0; i < 64; i++) {
                salt += String.fromCharCode(Math.floor(Math.random() * 95) + 32);
            }
            const firstHash = await globalThis.crypto.subtle.digest('SHA-512', new TextEncoder().encode(pwd + salt));
            const secondHash = await globalThis.crypto.subtle.digest('SHA-512', new TextEncoder().encode(Array.from(new Uint8Array(firstHash)).map((b) => b.toString(16).padStart(2, "0")).join("") + salt));
            const shaHash = Array.from(new Uint8Array(secondHash)).map((b) => b.toString(16).padStart(2, "0")).join("");
            const pbkdf2Key = await globalThis.crypto.subtle.importKey('raw', new TextEncoder().encode(shaHash), 'PBKDF2', false, ['deriveBits']);
            const rawHash = await globalThis.crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 1000000, hash: 'SHA-512' }, pbkdf2Key, 512);
            const hash = Array.prototype.map.call(new Uint8Array(rawHash), x => x.toString(16).padStart(2, '0')).join('');
            Object.assign(updateList.$set, { salt });
            Object.assign(updateList.$set, { pwd: hash });
        }
        if (firstName != null && typeof firstName === 'string') {
            Object.assign(updateList.$set, { firstName });
        }
        if (lastName != null && typeof lastName === 'string') {
            Object.assign(updateList.$set, { lastName });
        }
        if (perm != null && typeof perm === 'number') {
            Object.assign(updateList.$set, { perm });
        }
        if (accepted != null && typeof accepted === 'boolean') {
            Object.assign(updateList.$set, { accepted });
        }
        if (allergy != null && Array.isArray(allergy)) {
            Object.assign(updateList.$set, { allergy });
        }
        if (answerer != null && typeof answerer === 'boolean') {
            Object.assign(updateList.$set, { answerer });
        }
        if (lang != null && typeof lang === 'number') {
            Object.assign(updateList.$set, { lang });
        }
        await usersCollection.updateOne({ id }, updateList);
        client.close();
        return new Response(JSON.stringify({ code: 0 }), { status: 200 });
    }
}