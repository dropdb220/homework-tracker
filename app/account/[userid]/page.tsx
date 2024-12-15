'use client';

import Image from "next/image";
import Link from "next/link";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useLocalStorage } from "usehooks-ts";

import { LSAccount, AccountInfo, permToString, langToString } from "@/app/types";

const OtherAccountInfopage: React.FC<{ params: Promise<{ userid: string }> }> = (props: { params: Promise<{ userid: string }> }) => {
    const params = use(props.params);
    const router = useRouter();
    const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null);
    const [isClient, setIsClient] = useState(false);
    const [isOffline, setIsOffline] = useState(false);
    const [myPerm, setMyPerm] = useState(2);

    const [account, setAccount] = useLocalStorage<LSAccount | null>('account', null);

    useEffect(() => {
        setIsClient(true);
    }, []);
    useEffect(() => {
        if (!isClient) return;
        fetch('/api/account?id=' + decodeURIComponent(params.userid)).then(async res => {
            if (res.ok) {
                setAccountInfo((await res.json()).data);
            } else {
                router.replace('/login/id');
            }
        }).catch(() => {
            setIsOffline(true);
        })
    }, [isClient, router, params.userid, isOffline]);
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
    useEffect(() => {
        if (!isClient) return;
        if (account && account.id && account.token) {
            fetch('/api/account?id=' + account.id).then(async res => {
                if (res.ok) {
                    setMyPerm((await res.json()).data.perm);
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
    }, [account, router, setAccount, isClient]);

    return isOffline ? (
        <>
            <div className="kor">
                <Image src="/offline.svg" alt="오프라인 상태" width={150} height={150} className="mt-2 mb-8 ml-auto mr-auto dark:invert" />
                <h2>오프라인 상태입니다.</h2>
                <p>계정 정보를 확인하려면 인터넷 연결이 필요합니다.</p>
            </div>
            <div className="eng">
                <Image src="/offline.svg" alt="Offline" width={150} height={150} className="mt-2 mb-8 ml-auto mr-auto dark:invert" />
                <h2>You{'\''}re offline.</h2>
                <p>An active internet conenction is required to view account details.</p>
            </div>
        </>
    ) : (
        <div className="w-full lg:w-[80%] md:grid md:grid-cols-2 md:gap-2 ml-auto mr-auto">
            <div className="mb-4 lg:mt-24">
                <div className="grid grid-cols-[auto_auto_1fr]">
                    <button onClick={(e) => {
                        e.preventDefault();
                        router.back();
                    }}>
                        <Image src="/back.svg" alt="뒤로가기" height={36} width={36} className="relative mt-[.125rem] dark:invert w-9 h-9 kor" />
                        <Image src="/back.svg" alt="Back" height={36} width={36} className="relative mt-[.125rem] dark:invert w-9 h-9 eng" />
                    </button>
                    <h1 className="text-3xl ml-4 kor">계정 정보</h1>
                    <h1 className="text-3xl ml-4 eng">Account Info</h1>
                    <div></div>
                </div>
                <br />
                <h1 className="text-5xl">{isClient ? decodeURIComponent(params.userid) : ''}</h1>
            </div>
            <div className="lg:mt-24">
                <p className="text-sm kor">이름</p>
                <p className="text-sm eng">Name</p>
                <p className="text-xl">{accountInfo?.firstName} {accountInfo?.lastName}</p>
                <br />
                <p className="text-sm kor">권한</p>
                <p className="text-sm eng">Permissions</p>
                <p className="text-xl">{permToString[accountInfo?.perm ?? 3]}</p>
                <br />
                <p className="text-sm kor">상태</p>
                <p className="text-sm eng">Status</p>
                <p className="text-xl kor">{accountInfo?.accepted ? '승인됨' : '승인되지 않음'}</p>
                <p className="text-xl eng">{accountInfo?.accepted ? 'Accepted' : 'Not Accepted'}</p>
                {process.env.NEXT_PUBLIC_QNA_ENABLED == '1' &&

                    <>
                        <div className="kor">
                            <br />
                            <p className="text-sm">질문 답변자 여부</p>
                            <p className="text-xl">{accountInfo?.answerer ? '가능' : '불가능'}</p>
                        </div>
                        <div className="eng">
                            <br />
                            <p className="text-sm">Is Answerer</p>
                            <p className="text-xl">{accountInfo?.answerer ? 'Yes' : 'No'}</p>
                        </div>
                    </>
                }
                <br />
                <p className="text-sm">언어{'('}Language{')'}</p>
                <p className="text-xl">{langToString[accountInfo?.lang ?? 2]}</p>
                {(isClient && myPerm < 2) &&
                    <>
                        <br />
                        <Link href={`/account/edit/${params.userid}`}>
                            <button className="w-[50%] ml-[50%] p-3 mt-4 rounded-lg bg-gray-500 text-white hover:bg-gray-700 dark:bg-gray-600 dark:hover:bg-gray-800 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:hover:bg-gray-500 dark:disabled:hover:bg-gray-700 transition-all ease-in-out duration-200 focus:ring">
                                <span className="kor">정보 수정</span>
                                <span className="eng">Edit Info</span>
                            </button>
                        </Link>
                    </>
                }
            </div>
        </div>
    );
}

export default OtherAccountInfopage