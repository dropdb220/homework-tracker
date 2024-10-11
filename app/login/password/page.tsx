'use client';

import Image from "next/image";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLocalStorage } from "usehooks-ts";

import { LSAccount } from "@/app/types";

export default function LoginPhase2() {
    const router = useRouter();

    const [pwd, setPwd] = useState('');
    const [loginFailed, setLoginFailed] = useState(false);
    const [loggingIn, setLoggingIn] = useState(false);
    const [failedMsg, setFailedMsg] = useState('');
    const [isOffline, setIsOffline] = useState(false);

    const [account, setAccount] = useLocalStorage<LSAccount | null>('account', null);

    useEffect(() => {
        if (!account || !account.id) router.replace('/login/id');
    }, [account, router]);
    useEffect(() => {
        if (isOffline) {
            const interval = setInterval(() => {
                fetch('/api/is_online').then(() => {
                    setIsOffline(false);
                }).catch(() => {
                    setIsOffline(true);
                });
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [isOffline]);

    return isOffline ? (
        <>
            <Image src="/offline.svg" alt="오프라인 상태" width={150} height={150} className="mt-2 mb-8 ml-auto mr-auto dark:invert" />
            <h2>오프라인 상태입니다.</h2>
            <p>로그인하려면 인터넷 연결이 필요합니다.</p>
        </>
    ) : (
        <div className="w-full lg:w-[80%] md:grid md:grid-cols-2 md:gap-2 ml-auto mr-auto">
            <div className="mb-4 lg:mt-24">
                <div className="grid grid-cols-[auto_auto_1fr]">
                    <button onClick={(e) => {
                        e.preventDefault();
                        router.back();
                    }}><Image src="/back.svg" alt="뒤로가기" height={36} width={36} className="relative mt-[.125rem] dark:invert w-9 h-9" /></button>
                    <h1 className="text-3xl ml-4">{account?.id}</h1>
                    <div></div>
                </div>
            </div>
            <div className="lg:mt-24">
                <form onSubmit={e => {
                    e.preventDefault();
                    setLoggingIn(true);
                    fetch('/api/login', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ id: account?.id, pwd })

                    }).then(async res => {
                        if (res.ok) {
                            setLoginFailed(false);
                            setAccount({ id: account?.id, token: (await res.json()).token });
                            router.push('/');
                        } else {
                            setLoggingIn(false);
                            setLoginFailed(true);
                            setFailedMsg((await res.json()).msg);
                        }
                    });
                }}>
                    <input type="text" id="id" value={account?.id} className="hidden" autoComplete="username" readOnly />
                    <input type="password" id="pwd" placeholder="비밀번호" className="border border-slate-400 h-12 rounded-lg p-4 w-[100%] dark:bg-[#424242]" autoComplete="current-password" autoFocus onKeyUp={e => {
                        setPwd(e.currentTarget.value);
                        if (e.key.length === 1) setLoginFailed(false);
                    }} />
                    <br />
                    {loginFailed ? <p className="text-red-500">{failedMsg}</p> : <br />}
                    <br />
                    <br />
                    <br />
                    <button className="w-[40%] ml-[60%] mr-0 pt-3 pb-3 mt-4 rounded-lg bg-blue-500 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-800 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:hover:bg-gray-500 dark:disabled:hover:bg-gray-700 transition-all ease-in-out duration-200 focus:ring" disabled={pwd.length === 0 || loggingIn} type="submit">로그인</button>
                </form>
            </div>
        </div>
    );
}