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
    const [isClient, setIsClient] = useState<boolean>(false);

    const [account, setAccount] = useLocalStorage<LSAccount | null>('account', null);

    useEffect(() => {
        setIsClient(true);
    }, []);
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
            <div className="kor">
                <Image src="/offline.svg" alt="오프라인 상태" width={150} height={150} className="mt-2 mb-8 ml-auto mr-auto dark:invert" />
                <h2>오프라인 상태입니다.</h2>
                <p>로그인하려면 인터넷 연결이 필요합니다.</p>
            </div>
            <div className="eng">
                <Image src="/offline.svg" alt="Offline" width={150} height={150} className="mt-2 mb-8 ml-auto mr-auto dark:invert" />
                <h2>You{'\''}re offline.</h2>
                <p>An active internet connection is required to login.</p>
            </div>
        </>
    ) : (
        <>
            <style>
                {`#logo_text {
                    color: black !important;
                }`}
            </style>
            <div className="w-full lg:w-[80%] p-16 mt-24 rounded-2xl md:grid md:grid-cols-2 md:gap-2 ml-auto mr-auto bg-[rgb(var(--background-rgb))]">
                <div className="mb-4 lg:mt-24">
                    <div className="grid grid-cols-[auto_auto_1fr]">
                        <button onClick={(e) => {
                            e.preventDefault();
                            router.back();
                        }}>
                            <Image src="/back.svg" alt="뒤로가기" height={36} width={36} className="relative mt-[.125rem] dark:invert w-9 h-9 kor" />
                            <Image src="/back.svg" alt="Back" height={36} width={36} className="relative mt-[.125rem] dark:invert w-9 h-9 eng" />
                        </button>
                        <h1 className="text-3xl ml-4">{isClient ? account?.id : ''}</h1>
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
                                'Content-Type': 'application/json',
                                'X-Is-Mobile': navigator.maxTouchPoints > 0 ? '1' : '0'
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
                        <input type="password" id="pwd1" placeholder="비밀번호" className="kor border border-slate-400 h-12 rounded-lg p-4 w-full dark:bg-[#424242]" autoComplete="current-password" autoFocus onKeyUp={e => {
                            setPwd(e.currentTarget.value);
                            if (e.key.length === 1) setLoginFailed(false);
                        }} />
                        <input type="password" id="pwd2" placeholder="Password" className="eng border border-slate-400 h-12 rounded-lg p-4 w-full dark:bg-[#424242]" autoComplete="current-password" autoFocus onKeyUp={e => {
                            setPwd(e.currentTarget.value);
                            if (e.key.length === 1) setLoginFailed(false);
                        }} />
                        <br />
                        {loginFailed ? <p className="text-red-500">{failedMsg}</p> : <br />}
                        <br />
                        <br />
                        <br />
                        <button className="w-[40%] ml-[60%] mr-0 pt-3 pb-3 mt-4 rounded-lg bg-blue-500 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-800 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:hover:bg-gray-500 dark:disabled:hover:bg-gray-700 transition-all ease-in-out duration-200 focus:ring-3" disabled={pwd.length === 0 || loggingIn} type="submit">
                            <span className="kor">로그인{loggingIn ? " 중..." : ""}</span>
                            <span className="eng">{loggingIn ? "Logging in..." : "Login"}</span>
                        </button>
                    </form>
                </div>
            </div>
            <div className="-z-2 fixed top-0 left-0 w-dvw h-dvh bg-[url(/login_background.png)] bg-cover"></div>
        </>
    );
}