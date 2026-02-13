/**
 * preview-page-timeline.js
 * プレビュー画面のロジックを担当する。
 * sessionStorage/IndexedDBからデータを読み込み、
 * プレビュー表示とアニメーションタイムラインの再生制御を行う。
 */
const stored = sessionStorage.getItem("giftPreviewData");
        const data = stored ? JSON.parse(stored) : null;

        const introScreen = document.getElementById("introScreen");
        const videoCanvas = document.getElementById("videoCanvas");
        const giftBox = document.getElementById("giftBox");
        const replayButton = document.getElementById("replayButton");
        const creatorFrame = document.querySelector(".creator-frame");

        // 画像キャッシュ用のIndexedDBを開く（未作成時はimagesストアを作成）。
        const openImageDb = () => new Promise((resolve, reject) => {
            const request = indexedDB.open("giftbox-images", 1);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains("images")) {
                    db.createObjectStore("images");
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        // 指定キーの画像データをIndexedDBから取得する。
        const idbGet = async (key) => {
            const db = await openImageDb();
            return new Promise((resolve, reject) => {
                const tx = db.transaction("images", "readonly");
                const request = tx.objectStore("images").get(key);
                request.onsuccess = () => resolve(request.result || null);
                request.onerror = () => reject(request.error);
            });
        };

        const knownImages = new Set([
            "chara_send.jpg",
            "chara_receive.jpg",
            "present1.png",
            "present2.png",
            "present3.png",
            "present4.png",
            "present5.png",
            "present6.png",
            "presentbox1_close.png",
            "presentbox1_open.png",
            "present_effect.png",
            "background_wait.jpg",
            "background_result.jpg",
            "heart.png"
        ]);
        // 保存データと既知画像名から表示用パスを解決し、なければフォールバックを使う。
        const resolveImagePath = (pathValue, nameValue, fallback) => {
            if (pathValue && pathValue.startsWith("assets/")) return pathValue;
            if (nameValue && knownImages.has(nameValue)) return `assets/images/${nameValue}`;
            return fallback;
        };

        const giverName = data?.giverName?.trim() || "テレーズ";
        const receiverName = data?.receiverName?.trim() || "ヘクター";
        const authorName = data?.authorName?.trim() || "未入力";
        const giftTypeFallbackImages = {
            "type-a": "assets/images/present1.png",
            "type-b": "assets/images/present2.png",
            "type-c": "assets/images/present3.png",
            "type-d": "assets/images/present4.png",
            "type-e": "assets/images/present5.png",
            "type-f": "assets/images/present6.png"
        };
        const fallbackGiftImage = giftTypeFallbackImages[data?.giftType] || "assets/images/present1.png";
        let giverImage = data?.giverImageData || resolveImagePath(data?.giverImagePath, data?.giverImage, "assets/images/chara_send.jpg");
        let receiverImage = data?.receiverImageData || resolveImagePath(data?.receiverImagePath, data?.receiverImage, "assets/images/chara_receive.jpg");
        let giftImage = data?.giftImageData || resolveImagePath(data?.giftImagePath, data?.giftImage, fallbackGiftImage);

        const giftItem = document.getElementById("giftItem");
        const chatLayer = document.getElementById("chatLayer");
        const senderReaction = document.getElementById("senderReaction");
        const receiverReaction = document.getElementById("receiverReaction");
        const baseBackground = "assets/images/background_wait.jpg";
        const resultBackground = "assets/images/background_result.jpg";
        let timelineTimers = [];
        let creatorHideTimer = null;
        let replayStartTimer = null;
        const objectUrls = [];
        let hasUserStarted = false;

        // チャット吹き出しを時間差で順番に描画する。
        const renderChatSequential = (container, lines, speaker, alignClass, baseDelayMs = 0) => {
            if (!container) return;
            container.innerHTML = "";
            const filtered = (lines || []).map((line) => line.trim()).filter((line) => line.length);
            const messages = filtered.length ? filtered.slice(0, 6) : ["未入力"];
            messages.forEach((text, index) => {
                setTimeout(() => {
                    const bubble = document.createElement("div");
                    bubble.className = `chat-bubble ${alignClass}`;
                    const label = document.createElement("p");
                    label.className = "chat-label";
                    label.textContent = speaker;
                    const body = document.createElement("p");
                    body.className = "chat-text";
                    body.textContent = text;
                    bubble.append(label, body);
                    container.appendChild(bubble);
                }, baseDelayMs + index * 900);
            });
        };

        // 動画ステージの背景画像スタイルを更新する。
        const setChatBackground = (imageUrl) => {
            if (!videoCanvas) return;
            videoCanvas.style.backgroundImage = `url("${imageUrl}")`;
            videoCanvas.style.backgroundPosition = "center";
            videoCanvas.style.backgroundSize = "cover";
            videoCanvas.style.backgroundRepeat = "no-repeat";
        };
        // フェード演出を挟んで背景を切り替え、完了後にコールバックを呼ぶ。
        const fadeToBackground = (imageUrl, callback) => {
            if (!videoCanvas) return;
            videoCanvas.classList.add("fade-stage");
            setTimeout(() => {
                setChatBackground(imageUrl);
                videoCanvas.classList.remove("fade-stage");
                if (typeof callback === "function") callback();
            }, 600);
        };

        // 再生中タイマーをすべて停止して初期化する。
        const clearTimeline = () => {
            timelineTimers.forEach((timer) => clearTimeout(timer));
            timelineTimers = [];
            if (creatorHideTimer) {
                clearTimeout(creatorHideTimer);
                creatorHideTimer = null;
            }
            if (replayStartTimer) {
                clearTimeout(replayStartTimer);
                replayStartTimer = null;
            }
        };

        // タイムライン用のCSS状態と表示要素を初期状態へ戻す。
        const resetStages = () => {
            if (!videoCanvas || !giftBox) return;
            videoCanvas.classList.remove(
                "show-box",
                "open-box-stage",
                "reveal-stage",
                "fade-stage",
                "chat-stage",
                "chat-giver-stage",
                "chat-receiver-stage"
            );
            giftBox.classList.remove("box-shake");
            if (chatLayer) chatLayer.innerHTML = "";
            if (senderReaction) senderReaction.innerHTML = "";
            if (receiverReaction) receiverReaction.innerHTML = "";
            if (creatorFrame) creatorFrame.classList.remove("is-hidden");
            videoCanvas.style.setProperty("--chat-bg", `url("${baseBackground}")`);
            setChatBackground(baseBackground);
        };

        // ギフト演出から会話表示までのタイムライン再生を開始する。
        const startTimeline = (creatorHideDelayMs = 0) => {
            if (!videoCanvas || !giftBox) return;
            resetStages();
            if (creatorFrame) {
                creatorHideTimer = setTimeout(() => {
                    creatorFrame.classList.add("is-hidden");
                    creatorHideTimer = null;
                }, creatorHideDelayMs);
            }
            // タイムライン管理用にsetTimeoutを登録して追跡する。
            const addTimer = (fn, delay) => {
                timelineTimers.push(setTimeout(fn, delay));
            };
            addTimer(() => {
                videoCanvas.classList.add("show-box");
                giftBox.classList.add("box-shake");
            }, 500);

            addTimer(() => {
                giftBox.classList.remove("box-shake");
                videoCanvas.classList.add("open-box-stage");
                setChatBackground(resultBackground);
            }, 2800);

            addTimer(() => {
                videoCanvas.classList.add("reveal-stage");
                renderChatSequential(senderReaction, data?.senderReactionLines || [], giverName, "bubble-giver");
                renderChatSequential(receiverReaction, data?.reactionLines || [], receiverName, "bubble-receiver");
            }, 4200);

            addTimer(() => {
                videoCanvas.classList.add("fade-stage");
            }, 14200);

            addTimer(() => {
                videoCanvas.classList.remove("fade-stage");
                videoCanvas.classList.add("chat-stage", "chat-giver-stage");
                videoCanvas.style.setProperty("--chat-bg", `url("${giverImage}")`);
                setChatBackground(giverImage);
                renderChatSequential(chatLayer, data?.giverLines || [], giverName, "bubble-giver");
            }, 15200);

            addTimer(() => {
                videoCanvas.classList.remove("chat-giver-stage");
                videoCanvas.classList.add("chat-receiver-stage");
                videoCanvas.style.setProperty("--chat-bg", `url("${receiverImage}")`);
                fadeToBackground(receiverImage, () => {
                    renderChatSequential(chatLayer, data?.receiverLines || [], receiverName, "bubble-receiver");
                });
            }, 25200);
        };

        // 名前と画像をイントロ表示・ギフト表示へ反映する。
        const applyImages = () => {
            if (introScreen) {
                const giverNameEl = introScreen.querySelector(".intro-name");
                const receiverNameEl = introScreen.querySelector(".intro-receiver-name");
                const authorNameEl = document.getElementById("introAuthorName");
                const watermarkAuthorNameEl = document.getElementById("watermarkAuthorName");
                const avatars = introScreen.querySelectorAll(".intro-avatar");
                if (giverNameEl) {
                    giverNameEl.textContent = giverName;
                }
                if (receiverNameEl) {
                    receiverNameEl.textContent = receiverName;
                }
                if (authorNameEl) {
                    authorNameEl.textContent = authorName;
                }
                if (watermarkAuthorNameEl) {
                    watermarkAuthorNameEl.textContent = `Creator by ${authorName}`;
                }
                if (avatars[0]) {
                    avatars[0].src = giverImage;
                }
                if (avatars[1]) {
                    avatars[1].src = receiverImage;
                }
            }
            if (giftItem) {
                giftItem.src = giftImage;
            }
        };

        // 画像データを復元して画面へ適用する。
        const initImagesAndStart = async () => {
            try {
                const giverBlob = data?.giverImageData ? null : await idbGet("giverImage");
                const receiverBlob = data?.receiverImageData ? null : await idbGet("receiverImage");
                const giftBlob = data?.giftImageData ? null : await idbGet("giftImage");
                if (giverBlob) {
                    giverImage = URL.createObjectURL(giverBlob);
                    objectUrls.push(giverImage);
                }
                if (receiverBlob) {
                    receiverImage = URL.createObjectURL(receiverBlob);
                    objectUrls.push(receiverImage);
                }
                if (giftBlob) {
                    giftImage = URL.createObjectURL(giftBlob);
                    objectUrls.push(giftImage);
                }
            } catch {
                // ignore storage errors
            }

            applyImages();
        };

        initImagesAndStart();

        // 最初のタップ/クリックでタイムライン再生を開始する。
        const startOnFirstGesture = () => {
            if (hasUserStarted) return;
            hasUserStarted = true;
            clearTimeline();
            startTimeline(0);
        };

        if (videoCanvas) {
            videoCanvas.addEventListener("click", startOnFirstGesture);
            videoCanvas.addEventListener("touchstart", startOnFirstGesture, { passive: true });
        }

        if (replayButton) {
            replayButton.addEventListener("click", () => {
                hasUserStarted = true;
                clearTimeline();
                replayStartTimer = setTimeout(() => {
                    startTimeline(1000);
                    replayStartTimer = null;
                }, 1000);
            });
        }

        window.addEventListener("beforeunload", () => {
            objectUrls.forEach((url) => URL.revokeObjectURL(url));
        });
















