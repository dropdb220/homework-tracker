'use client';

import { formatDistanceToNowStrict, sub } from "date-fns";
import { ko, enUS } from 'date-fns/locale';

import Link from "next/link";
import Dialog from "@/app/dialog";

import { LSAccount, deadlineName } from "@/app/types";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLocalStorage } from "usehooks-ts";

function CreatedTime({ datetime }: { datetime: Date }) {
    const [tick, setTick] = useState<number>(0);
    useEffect(() => {
        const interval = setInterval(() => {
            setTick(tick + 1);
        }, 1000);
        return () => clearInterval(interval);
    }, [tick]);

    return <>
        <div className="kor">{formatDistanceToNowStrict(new Date(datetime), { locale: ko, addSuffix: true })}</div>
        <div className="eng">{formatDistanceToNowStrict(new Date(datetime), { locale: enUS, addSuffix: true })}</div>
    </>
}

export default function QuestionList() {
    const [isClient, setIsClient] = useState<boolean>(false);
    const [questions, setQuestions] = useState<Array<{ idx: number, user: string, title: string, created: Date, solved: boolean }>>([]);
    const [canView, setCanView] = useState<boolean>(true);
    const [isOffline, setIsOffline] = useState<boolean>(false);
    const [page, setPage] = useState<number>(1);
    const [maxPage, setMaxPage] = useState<number>(1);
    const router = useRouter();

    const [account, setAccount] = useLocalStorage<LSAccount | null>('account', null);
    const [notification, setNotification] = useLocalStorage<any>('notification', null);
    const [myOnly, setMyOnly] = useLocalStorage<boolean>('my_question_only', true);
    const [unsolvedOnly, setUnsolvedOnly] = useLocalStorage<boolean>('unsolved_only', false);

    useEffect(() => {
        setIsClient(true);
    }, []);
    useEffect(() => {
        if (!account || !account.token) router.replace('/');
        else fetch(`/api/question`, {
            method: 'GET',
            headers: {
                Authorization: account.token
            }
        }).then(response => {
            if (!response.ok) {
                router.replace('/');
            }
        })
    }, [router, account]);
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
        if (!account || !account.token) setCanView(false);
        else fetch('/api/question', {
            method: 'GET',
            headers: {
                Authorization: account.token
            }
        }).then(response => {
            if (!response.ok) {
                setCanView(false);
                if (response.status === 401) {
                    setAccount(null);
                    setNotification(null);
                }
            } else {
                setCanView(true);
                response.json().then(data => {
                    setQuestions(data.questions);
                });
            }
        })
    }, [account, setAccount, setNotification]);
    useEffect(() => {
        setMaxPage(Math.max(1, Math.ceil(questions.filter((q: any) => !unsolvedOnly || !q.solved).filter((q: any) => !myOnly || q.user === account?.id).length / 10)));
        if (questions.length > 0 && maxPage < page) setPage(maxPage);
    }, [questions, page, maxPage, unsolvedOnly, myOnly, account]);

  useEffect(() => {
    if (questions.length === 0) return;
    questions.forEach(question => {
      fetch(`/question/${question.idx}`).catch(() => { }); // cache to service worker
    });
    if (account && account.token) {
        questions.forEach(question => {
            fetch(`/api/question/${question.idx}`, {
                method: 'GET',
                headers: {
                    Authorization: account.token!
                }
            }).catch(() => { }); // cache to service worker
        });
    }
  }, [questions, account]);

    return (
        <div className="w-[90%] md:w-[700px] md:border md:border-slate-400 md:p-8 md:rounded-lg ml-auto mr-auto">
            {canView && isClient ?
                <>
                    <Link href="/question/write">
                        <button className={`ml-[70%] w-[30%] mr-0 pt-3 pb-3 mt-0 rounded-lg bg-blue-500 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-800 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:hover:bg-gray-500 dark:disabled:hover:bg-gray-700 transition-all ease-in-out duration-200 focus:ring-3`}>
                            <span className="kor">질문하기</span>
                            <span className="eng">Ask</span>
                        </button>
                    </Link>
                    <br />
                    <input type="checkbox" id="unsolvedOnly" className="mr-2 h-5 mt-1 mb-1" checked={unsolvedOnly} onChange={(e) => {
                        setUnsolvedOnly(e.target.checked);
                    }} />
                    <label htmlFor="unsolvedOnly" className="kor">미해결 질문만 보기</label>
                    <label htmlFor="unsolvedOnly" className="eng">Show unsolved questions only</label>
                    <br />
                    <input type="checkbox" id="myOnly" className="mr-2 h-5 mt-1 mb-1" checked={myOnly} onChange={(e) => {
                        setMyOnly(e.target.checked);
                    }} />
                    <label htmlFor="myOnly" className="kor">내가 쓴 질문만 보기</label>
                    <label htmlFor="myOnly" className="eng">Show my questions only</label>
                    <br />
                    <br />
                    {questions.filter(q => !unsolvedOnly || !q.solved).filter(q => !myOnly || q.user === account?.id).slice(page * 10 - 10, page * 10).map((question, idx) => {
                        return (
                            <Link key={idx} href={`/question/${question.idx}`}>
                                <div className="border-t border-t-slate-400">
                                    <br />
                                    <h1 className="text-4xl inline">{question.title}</h1>
                                    <CreatedTime datetime={question.created} />
                                </div>
                                <br />
                            </Link>
                        );
                    })}
                    <div className="text-center border-t border-t-slate-400">
                        <br />
                        {[...Array(maxPage)].map((_, idx) => (
                            <button key={idx} className={`ml-1 mr-1 pt-1 pb-1 rounded-lg text-black dark:text-white transition-all ease-in-out duration-200 ${idx + 1 === page ? 'font-bold' : ''}`} onClick={() => {
                                setPage(idx + 1);
                            }}>{idx + 1}</button>
                        ))}
                    </div>
                </>
                : (
                    (account && account.token && isClient) ? (
                        <div className="bg-red-500 p-4 border border-red-500 rounded-sm text-white">
                            <p className="kor">관리자의 계정 승인이 필요합니다.</p>
                            <p className="eng">Administrator approval is required.</p>
                        </div>
                    ) : (
                        <div className="bg-red-500 p-4 border border-red-500 rounded-sm text-white">
                            <p className="kor">로그인이 필요합니다.</p>
                            <p className="eng">Please login.</p>
                        </div>
                    )
                )
            }
        </div>
    );
}
