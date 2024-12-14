import { MongoClient } from "mongodb";
import fetch from "node-fetch";
import i18n from "@/app/i18n.json";

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    let clientLang = !isNaN(Number(request.headers.get('X-Lang') || undefined)) ? Number(request.headers.get('X-Lang')) : request.headers.get('Accept-Language')?.startsWith("en") ? 1 : 0;
    if (clientLang !== 0 && clientLang !== 1) clientLang = request.headers.get('Accept-Language')?.startsWith("en") ? 1 : 0;
    const siteToken = request.headers.get('Authorization');
    if (!siteToken) {
        return new Response(JSON.stringify({ code: 1, msg: i18n.loginRequired[clientLang] }), { status: 401 });
    }
    const client = new MongoClient(process.env.MONGO!);
    await client.connect();
    const db = client.db(process.env.DB_NAME);
    const tokenCollection = db.collection('tokens');
    const tokenToUser = await tokenCollection.findOne({ token: siteToken });
    if (!tokenToUser) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: i18n.invalidLogin[clientLang] }), { status: 401 });
    }
    const usersCollection = db.collection('users');
    const loginedUser = await usersCollection.findOne({ id: tokenToUser.id });
    clientLang = loginedUser!.lang;
    const code = (await request.json()).code;
    if (!code) {
        return new Response(JSON.stringify({ code: 1, msg: i18n.invalidAccess[clientLang] }), { status: 400 });
    }

    if (loginedUser!.discordConnected) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: i18n.alreadyConnected[clientLang] }), { status: 400 });
    }

    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            client_id: process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID!,
            client_secret: process.env.DISCORD_CLIENT_SECRET!,
            grant_type: 'authorization_code',
            code,
            redirect_uri: process.env.NEXT_PUBLIC_DISCORD_REDIRECT_URI!
        }).toString()
    });
    if (!tokenResponse.ok) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: i18n.failedToGetToken[clientLang] }), { status: 500 });
    }
    const token: any = await tokenResponse.json();
    const userResponse = await fetch('https://discord.com/api/users/@me', {
        headers: {
            Authorization: `${token.token_type} ${token.access_token}`
        }
    });
    if (!userResponse.ok) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: i18n.failedToGetUser[clientLang] }), { status: 500 });
    }
    const user: any = await userResponse.json();
    const guildResponse = await fetch('https://discord.com/api/users/@me/guilds', {
        headers: {
            Authorization: `${token.token_type} ${token.access_token}`
        }
    });
    if (!guildResponse.ok) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: i18n.failedToGetGuild[clientLang] }), { status: 500 });
    }
    const guilds: any = await guildResponse.json();
    const guild = guilds.find((guild: any) => guild.id === process.env.DISCORD_GUILD_ID);
    if (!guild) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: i18n.notInGuild[clientLang] }), { status: 403 });
    }
    const assignRoleResponse = await fetch(`http://localhost:${process.env.DISCORD_BOT_SERVER_PORT}/authuser`, {
        method: 'POST',
        headers: {
            'authorization': process.env.DISCORD_BOT_SERVER_AUTH!,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({ id: user.id }).toString()
    });
    if (!assignRoleResponse.ok) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: i18n.failedToAssignRole[clientLang] }), { status: 500 });
    }
    await usersCollection.updateOne({ id: loginedUser!.id }, { $set: { discordConnected: true, discordID: user.id } });
    client.close();
    return new Response(JSON.stringify({ code: 0, data: { id: user.id } }), { status: 200 });
}

export async function DELETE(request: Request) {
    let clientLang = !isNaN(Number(request.headers.get('X-Lang') || undefined)) ? Number(request.headers.get('X-Lang')) : request.headers.get('Accept-Language')?.startsWith("en") ? 1 : 0;
    if (clientLang !== 0 && clientLang !== 1) clientLang = request.headers.get('Accept-Language')?.startsWith("en") ? 1 : 0;
    const siteToken = request.headers.get('Authorization');
    if (!siteToken) {
        return new Response(JSON.stringify({ code: 1, msg: i18n.loginRequired[clientLang] }), { status: 401 });
    }

    const client = new MongoClient(process.env.MONGO!);
    await client.connect();
    const db = client.db(process.env.DB_NAME);
    const tokenCollection = db.collection('tokens');
    const tokenToUser = await tokenCollection.findOne({ token: siteToken });
    if (!tokenToUser) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: i18n.invalidLogin[clientLang] }), { status: 401 });
    }
    const usersCollection = db.collection('users');
    const loginedUser = await usersCollection.findOne({ id: tokenToUser.id });
    clientLang = loginedUser!.lang;
    if (!loginedUser!.discordConnected) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: i18n.noAccount[clientLang] }), { status: 400 });
    }

    const removeRoleResponse = await fetch(`http://localhost:${process.env.DISCORD_BOT_SERVER_PORT}/deauthuser`, {
        method: 'POST',
        headers: {
            'authorization': process.env.DISCORD_BOT_SERVER_AUTH!,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({ id: loginedUser!.discordID }).toString()
    });
    if (!removeRoleResponse.ok) {
        client.close();
        return new Response(JSON.stringify({ code: 1, msg: i18n.failedToRemoveRole[clientLang] }), { status: 500 });
    }
    await usersCollection.updateOne({ id: loginedUser!.id }, { $set: { discordConnected: false, discordID: null } });
    client.close();
    return new Response(JSON.stringify({ code: 0 }), { status: 200 });
}