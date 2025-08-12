'use client';

import { formatDistanceStrict, formatDistanceToNowStrict } from "date-fns";
import { ko, enUS } from "date-fns/locale";
import i18n from "@/app/i18n.json";
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkToc from 'remark-toc'
import rehypeSlug from 'rehype-slug'
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { materialDark } from "react-syntax-highlighter/dist/cjs/styles/prism";
import Image from "next/image";
import Link from "next/link";
import Dialog from '@/app/dialog';
import ImageModal from "@/app/imagemodal";

import { AccountFlag, LSAccount, PrintStatus } from "@/app/types";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useLocalStorage } from "usehooks-ts";

function Tag({ status, className }: { status: PrintStatus, className?: string }) {
    return (
        <span className={`rounded-lg bg-${status == PrintStatus.completed ? 'green' : 'red'}-500 p-1 h-8 text-white ${className}`}>
            <span className="kor">{i18n[`printStat${status}`][0]}</span>
            <span className="eng">{i18n[`printStat${status}`][1]}</span>
        </span>
    )
}

function CreatedTime({ printReq }: { printReq: { idx: number, title: string, status: PrintStatus, comment: string, rejectReason?: string, created: Date, user: { id: string, firstName?: string, lastName?: string } } }) {
    const [tick, setTick] = useState<number>(0);
    const [isClient, setIsClient] = useState<boolean>(false);
    const [deviceLang, setDeviceLang] = useLocalStorage<number>('lang', 0);

    useEffect(() => {
        setIsClient(true);
    }, []);
    useEffect(() => {
        const timeout = setTimeout(() => {
            setTick(tick + 1);
        }, 1000);
        return () => clearTimeout(timeout);
    }, [tick]);

    return <h3 className="text-xl">{printReq.user.id}{printReq.user.firstName && printReq.user.lastName && ` (${printReq.user.firstName} ${printReq.user.lastName})`} | {formatDistanceToNowStrict(new Date(printReq.created), { locale: (deviceLang === 1 && isClient) ? enUS : ko, addSuffix: true })}</h3>;
}

function CopyButton({ content }: { content: string }) {
    const [isCopied, setIsCopied] = useState(false);
    const [lastCopied, setLastCopied] = useState(0);
    const [dialogTtile, setDialogTitle] = useState<string>('');
    const [dialogType, setDialogType] = useState<'alert' | 'confirm'>('alert');
    const [dialogContent, setDialogContent] = useState<string>('');
    const [showDialog, setShowDialog] = useState<boolean>(false);
    const [dialogCallback, setDialogCallback] = useState<{ callback: (result: boolean) => void }>({ callback: () => { } });
    const [isClient, setIsClient] = useState<boolean>(false);

    const [deviceLang, setDeviceLang] = useLocalStorage<number>('lang', 0);

    useEffect(() => {
        setIsClient(true);
    }, []);
    useEffect(() => {
        if (!isCopied) return;
        const timeout = setTimeout(() => {
            setIsCopied(false);
        }, 2000);
        return () => clearTimeout(timeout);
    }, [lastCopied, isCopied]);

    return (
        <button onClick={() => {
            if ('clipboard' in navigator) {
                navigator.clipboard.writeText(content).then(() => {
                    setIsCopied(true);
                    setLastCopied(Date.now());
                }).catch(() => {
                    setDialogType('alert');
                    setDialogTitle(deviceLang === 1 ? "Couldn't Copy to Clipboard" : '클립보드에 복사할 수 없음');
                    setDialogContent((deviceLang === 1 ? "This browser supports copying to clipboard, but copying is currently unavailable due to an unknown error.\nPlease manually copy the link below.\n\n" : '이 브라우저는 클립보드에 복사 기능을 지원하지만 알 수 없는 오류로 인해 현재 복사할 수 없습니다.\n아래 링크를 수동으로 복사해주세요.\n\n') + content);
                    setShowDialog(true);
                });
            } else {
                setDialogType('alert');
                setDialogTitle(deviceLang === 1 ? "Clipboard Unsupported Browser" : '클립보드 미지원 브라우저');
                setDialogContent((deviceLang === 1 ? "This browser doesn't support copying to clipboard. Please copy the link below.\n\n" : '이 브라우저는 현재 클립보드에 복사 기능을 지원하지 않습니다.\n아래 링크를 수동으로 복사해주세요.\n\n') + content);
                setShowDialog(true);
            }
        }}>
            {isCopied ?
                <Image src="/check.svg" alt={(deviceLang === 1 && isClient) ? "Copy Post Link" : "글 링크 복사하기"} width={24} height={24} className="dark:invert max-w-8 max-h-8" />
                : <Image src="/copy.svg" alt={(deviceLang === 1 && isClient) ? "Copy Post Link" : "글 링크 복사하기"} width={24} height={24} className="dark:invert max-w-8 max-h-8" />
            }
        </button>
    )
}

export default function PrintReq(props: { params: Promise<{ idx: string }> }) {
    const params = use(props.params);
    const router = useRouter();

    const [print, setPrint] = useState<{ idx: number, title: string, status: PrintStatus, comment: string, rejectReason?: string, created: Date, user: { id: string, firstName?: string, lastName?: string } }>({ idx: 0, title: '', status: PrintStatus.pending, comment: '', created: new Date(1970, 0, 1, 9, 0, 0), user: { id: '' } });
    const [perm, setPerm] = useState(2);
    const [printer, setPrinter] = useState(false);
    const [dialogTtile, setDialogTitle] = useState<string>('');
    const [dialogType, setDialogType] = useState<'alert' | 'confirm'>('alert');
    const [dialogContent, setDialogContent] = useState<string>('');
    const [showDialog, setShowDialog] = useState<boolean>(false);
    const [dialogCallback, setDialogCallback] = useState<{ callback: (result: boolean) => void }>({ callback: () => { } });
    const [isOffline, setIsOffline] = useState<boolean>(false);

    const [account, setAccount] = useLocalStorage<LSAccount | null>('account', null);
    const [deviceLang, setDeviceLang] = useLocalStorage<number>('lang', 0);

    useEffect(() => {
        if (!account || !account.token) router.replace('/');
        else fetch(`/api/print/${Number(params.idx)}`, {
            method: 'GET',
            headers: {
                Authorization: account.token
            }
        }).then(response => {
            if (!response.ok) {
                router.replace('/');
            } else {
                response.json().then(data => {
                    setPrint(data);
                })
            }
        })
    }, [params.idx, router, account]);
    useEffect(() => {
        fetch(`/api/account?id=${account?.id}`).then(res => {
            if (!res.ok) {
                setAccount(null);
                router.replace('/login/id');
            } else {
                res.json().then(data => {
                    setPerm(data.data.perm);
                    setPrinter((data.data.flag & AccountFlag.printer) !== 0);
                })
            }
        })
    }, [account, router, setAccount]);
    useEffect(() => {
        fetch(`/print/${params.idx}`).catch(() => { }); // cache to service worker
    }, [params.idx]);
    useEffect(() => {
        fetch('/api/is_online').then(() => {
            setIsOffline(false);
        }).catch(() => {
            setIsOffline(true);
        });
    }, []);
    useEffect(() => {
        if (isOffline) {
            const interval = setInterval(() => {
                fetch('/api/is_online').then(() => {
                    fetch(`/api/account?id=${account?.id}`).then(res => {
                        if (!res.ok) {
                            setAccount(null);
                            router.replace('/login/id');
                        } else {
                            res.json().then(data => {
                                setPerm(data.data.perm);
                            })
                        }
                    });
                    setIsOffline(false);
                }).catch(() => {
                    setIsOffline(true);
                });
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [isOffline, account, router, setAccount]);

    return (
        (<div className="w-full lg:w-[80%] md:grid md:grid-cols-2 md:gap-2 ml-auto mr-auto">
            <div className="mb-4 lg:mt-24 max-md:border-b-slate-400 max-md:border-b md:mr-8">
                <div className="border-b border-b-slate-400">
                    <div className="grid grid-cols-[auto_auto_1fr]">
                        <h1 className="text-4xl">{print.title}</h1>
                        <Tag status={print.status} className="mt-auto mb-auto ml-2" />
                        <span></span>
                    </div>
                    <br />
                    <div className="hidden bg-green-500"></div>
                    <div className="grid grid-cols-[auto_1fr_auto]">
                        <CreatedTime printReq={print} />
                        <span></span>
                        {typeof location !== 'undefined' ?
                            <CopyButton content={location.href} />
                            : <CopyButton content="" />
                        }
                    </div>
                    <br />
                </div>
                <div>
                    <br />
                    <h2 className="text-3xl font-bold">
                        <span className="kor">요청</span>
                        <span className="eng">Request</span>
                    </h2>
                    <br />
                    <Markdown
                        remarkPlugins={[
                            [remarkGfm],
                            [remarkToc, { tight: true, ordered: true, prefix: '', heading: '(table[ -]of[ -])?contents?|toc|목차' }]]}
                        rehypePlugins={[rehypeSlug]} components={{
                            // @ts-ignore
                            code({ node, inline, className, children, ...props }) {
                                const match = /language-(\w+)/.exec(className || "");
                                return !inline && match ? (
                                    // @ts-ignore
                                    (<SyntaxHighlighter
                                        language={match[1]}
                                        PreTag="div"
                                        {...props}
                                        style={materialDark}
                                    >
                                        {String(children).replace(/\n$/, "")}
                                    </SyntaxHighlighter>)
                                ) : (
                                    <code {...props}>{children}</code>
                                );
                            },
                            img: (image) => (image.src && image.src.startsWith('/') && !image.src?.startsWith('//')) ? (
                                <ImageModal src={image.src || ""} className="w-full">
                                    <Image
                                        src={image.src || ""}
                                        alt={image.alt || ""}
                                        width={0}
                                        height={0}
                                        sizes="100vw"
                                        className="w-full object-cover"
                                    />
                                </ImageModal>
                            ) : (
                                <ImageModal src={image.src || ""} className="w-full">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={image.src || ""}
                                        alt={image.alt || ""}
                                        width={0}
                                        height={0}
                                        sizes="100vw"
                                        className="w-full object-cover"
                                    />
                                </ImageModal>
                            ),
                            a: (link) => (
                                <Link href={link.href || ""} rel="noopener noreferrer" target={(link.href || '').startsWith('#') ? '_top' : "_blank"}>{link.children}</Link>
                            ),
                            p({ children, ...props }) {
                                return <div {...props}>{children}</div>
                            }
                        }} className="prose dark:prose-invert">{print.comment}</Markdown>
                    <br />
                </div>
            </div>
            <div className="lg:mt-24 md:ml-8">
                {print.status === PrintStatus.rejected &&
                    <div className="border-b border-b-slate-400">
                        <br />
                        <h2 className="text-3xl font-bold">
                            <span className="kor">거부 사유</span>
                            <span className="eng">Rejection Reason</span>
                        </h2>
                        <br />
                        <Markdown
                            remarkPlugins={[
                                [remarkGfm],
                                [remarkToc, { tight: true, ordered: true, prefix: '', heading: '(table[ -]of[ -])?contents?|toc|목차' }]]}
                            rehypePlugins={[rehypeSlug]} components={{
                                // @ts-ignore
                                code({ node, inline, className, children, ...props }) {
                                    const match = /language-(\w+)/.exec(className || "");
                                    return !inline && match ? (
                                        // @ts-ignore
                                        (<SyntaxHighlighter
                                            language={match[1]}
                                            PreTag="div"
                                            {...props}
                                            style={materialDark}
                                        >
                                            {String(children).replace(/\n$/, "")}
                                        </SyntaxHighlighter>)
                                    ) : (
                                        <code {...props}>{children}</code>
                                    );
                                },
                                img: (image) => (image.src && image.src.startsWith('/') && !image.src?.startsWith('//')) ? (
                                    <ImageModal src={image.src || ""} className="w-full">
                                        <Image
                                            src={image.src || ""}
                                            alt={image.alt || ""}
                                            width={0}
                                            height={0}
                                            sizes="100vw"
                                            className="w-full object-cover"
                                        />
                                    </ImageModal>
                                ) : (
                                    <ImageModal src={image.src || ""} className="w-full">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={image.src || ""}
                                            alt={image.alt || ""}
                                            width={0}
                                            height={0}
                                            sizes="100vw"
                                            className="w-full object-cover"
                                        />
                                    </ImageModal>
                                ),
                                a: (link) => (
                                    <Link href={link.href || ""} rel="noopener noreferrer" target={(link.href || '').startsWith('#') ? '_top' : "_blank"}>{link.children}</Link>
                                )
                            }} className="prose dark:prose-invert">{print.rejectReason}</Markdown>
                        <br />
                    </div>
                }
                <br />
                {!isOffline &&
                    <>
                        {(perm === 0) &&
                            <>
                                <button className={`ml-[40%] w-[25%] mr-0 pt-3 pb-3 mt-0 rounded-lg bg-blue-500 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-800 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:hover:bg-gray-500 dark:disabled:hover:bg-gray-700 transition-all ease-in-out duration-200 focus:ring-3`} onClick={e => {
                                    setDialogTitle(deviceLang === 1 ? "Accept Print Request" : '인쇄 요청 수락');
                                    setDialogContent(deviceLang === 1 ? "Have you finished printing this request? Please press Accept after you have completed printing." : '이 요청을 인쇄했습니까? 인쇄를 완료한 다음 수락을 눌러주세요.');
                                    setDialogType('confirm');
                                    setDialogCallback({
                                        callback: (result: boolean) => {
                                            if (!result) return;
                                            fetch(`/api/print/${params.idx}/accept`, {
                                                method: 'POST',
                                                headers: {
                                                    Authorization: account!.token!
                                                }
                                            }).then(response => {
                                                if (response.ok) setPrint({ ...print, status: PrintStatus.completed });
                                                else alert(deviceLang === 1 ? "Failed to accept." : '수락에 실패했습니다.');
                                            }).catch(() => {
                                                alert(deviceLang === 1 ? "Failed to accept." : '수락에 실패했습니다.');
                                            })
                                        }
                                    });
                                    setShowDialog(true);
                                }}>
                                    <span className="kor">수락</span>
                                    <span className="eng">Accept</span>
                                </button>
                                <Link href={`/print/${params.idx}/reject`}>
                                    <button className={`ml-[10%] w-[25%] mr-0 pt-3 pb-3 mt-0 rounded-lg bg-red-500 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-800 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:hover:bg-gray-500 dark:disabled:hover:bg-gray-700 transition-all ease-in-out duration-200 focus:ring-3`}>
                                        <span className="kor">거부</span>
                                        <span className="eng">Reject</span>
                                    </button>
                                </Link>
                                {(perm < 1 || account?.id === print.user.id) && <><br /><br /></>}
                            </>
                        }
                        {(perm < 1 || account?.id === print.user.id) &&
                            <>
                                <Link href={`/print/${params.idx}/edit`}>
                                    <button className={`ml-[40%] w-[25%] mr-0 pt-3 pb-3 mt-0 rounded-lg bg-blue-500 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-800 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:hover:bg-gray-500 dark:disabled:hover:bg-gray-700 transition-all ease-in-out duration-200 focus:ring-3`}>
                                        <span className="kor">수정</span>
                                        <span className="eng">Edit</span>
                                    </button>
                                </Link>
                                <button className="ml-[10%] w-[25%] mr-0 pt-3 pb-3 mt-0 rounded-lg bg-red-500 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-800 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:hover:bg-gray-500 dark:disabled:hover:bg-gray-700 transition-all ease-in-out duration-200 focus:ring-3" onClick={e => {
                                    fetch(`/api/print/${Number(params.idx)}`, {
                                        method: 'DELETE',
                                        headers: {
                                            Authorization: account!.token!
                                        }
                                    }).then(response => {
                                        if (response.ok) router.push('/print');
                                        else alert(deviceLang === 1 ? "Failed to delete." : '삭제에 실패했습니다.');
                                    }).catch(() => {
                                        alert(deviceLang === 1 ? "Failed to delete." : '삭제에 실패했습니다.');
                                    });
                                }}>
                                    <span className="kor">삭제</span>
                                    <span className="eng">Delete</span>
                                </button>
                            </>
                        }
                    </>
                }
            </div>
            {showDialog && <Dialog title={dialogTtile} content={dialogContent} type={dialogType} setShowDialog={setShowDialog} callback={dialogCallback.callback} />}
        </div>)
    );
}
