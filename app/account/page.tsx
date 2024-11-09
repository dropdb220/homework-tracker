'use client';

import Image from "next/image";
import Link from "next/link";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLocalStorage } from "usehooks-ts";

import { LSAccount, AccountInfo, permToString, langToString } from "@/app/types";

export default function MyAccountInfoPage() {
    const router = useRouter();
    const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null);
    const [isClient, setIsClient] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);
    const [isOffline, setIsOffline] = useState(false);

    const [account, setAccount] = useLocalStorage<LSAccount | null>('account', null);
    const [notification, setNotification] = useLocalStorage<any>('notification', null);

    useEffect(() => {
        setIsClient(true);
    }, []);
    useEffect(() => {
        if (!isClient) return;
        if (account && account.id && account.token) {
            fetch('/api/account?id=' + account.id).then(async res => {
                if (res.ok) {
                    setAccountInfo((await res.json()).data);
                } else {
                    setAccount(null);
                    router.replace('/login/id');
                }
            }).catch(() => {
                setIsOffline(true);
            })
        } else {
            router.replace('/login/id');
        }
    }, [account, isClient, router, setAccount, isOffline]);
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
            <p>계정 정보를 확인하려면 인터넷 연결이 필요합니다.</p>
        </>
    ) : (
        <div className="w-full lg:w-[80%] md:grid md:grid-cols-2 md:gap-2 ml-auto mr-auto">
            <div className="mb-4 lg:mt-24">
                <div className="grid grid-cols-[auto_auto_1fr]">
                    <button onClick={(e) => {
                        e.preventDefault();
                        router.back();
                    }}><Image src="/back.svg" alt="뒤로가기" height={36} width={36} className="relative mt-[.125rem] dark:invert w-9 h-9" /></button>
                    <h1 className="text-3xl ml-4">계정 정보</h1>
                    <div></div>
                </div>
                <br />
                <h1 className="text-5xl">{isClient ? account?.id : ''}</h1>
            </div>
            <div className="lg:mt-24">
                <p className="text-sm">이름</p>
                <p className="text-xl">{accountInfo?.firstName} {accountInfo?.lastName}</p>
                <br />
                <p className="text-sm">권한</p>
                <p className="text-xl">{permToString[accountInfo?.perm ?? 3]}</p>
                <br />
                <p className="text-sm">상태</p>
                <p className="text-xl">{accountInfo?.accepted ? '승인됨' : '승인되지 않음'}</p>
                {process.env.NEXT_PUBLIC_QNA_ENABLED == '1' &&
                    <>
                        <br />
                        <p className="text-sm">질문 답변자 여부</p>
                        <p className="text-xl">{accountInfo?.answerer ? '가능' : '불가능'}</p>
                    </>
                }
                <br />
                <p className="text-sm">언어</p>
                <p className="text-xl">{langToString[accountInfo?.lang ?? 2]}</p>
                <div className="grid grid-cols-2">
                    <Link href="/account/edit" className="mr-4">
                        <button className="w-full p-3 mt-4 rounded-lg bg-gray-500 text-white hover:bg-gray-700 dark:bg-gray-600 dark:hover:bg-gray-800 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:hover:bg-gray-500 dark:disabled:hover:bg-gray-700 transition-all ease-in-out duration-200 focus:ring">정보 수정</button>
                    </Link>
                    <button className="p-3 mt-4 ml-4 rounded-lg bg-red-500 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-800 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:hover:bg-gray-500 dark:disabled:hover:bg-gray-700 transition-all ease-in-out duration-200 focus:ring" disabled={loggingOut} onClick={() => {
                        setLoggingOut(true);
                        fetch('/api/logout', {
                            method: 'DELETE',
                            headers: {
                                Authorization: account!.token!
                            }
                        }).then(async () => {
                            setAccount(null);
                            setNotification(null);
                            if ('serviceWorker' in navigator) {
                                const registration = await navigator.serviceWorker.ready;
                                const subscription = await registration.pushManager.getSubscription();
                                if (subscription) {
                                    await subscription.unsubscribe();
                                }
                            }
                            router.push('/');
                        });
                    }}>로그아웃</button>
                </div>
            </div>
        </div>
    );
}