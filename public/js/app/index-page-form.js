/**
 * index-page-form.js
 * 入力フォーム画面のロジックを担当する。
 * フォーム復元、画像プレビュー/トリミング、ドラッグ&ドロップ、
 * IndexedDB保存、preview.htmlへ渡すデータ生成を行う。
 */
const giftForm = document.getElementById("giftForm");
const openDemoButton = document.getElementById("openDemoButton");
const demoModalElement = document.getElementById("demoModal");
const demoVideo = document.getElementById("demoVideo");
const giftTypeRadios = Array.from(document.querySelectorAll('input[name="giftType"]'));
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
        // 指定キーで画像データをIndexedDBへ保存する。
        const idbSet = async (key, value) => {
            const db = await openImageDb();
            return new Promise((resolve, reject) => {
                const tx = db.transaction("images", "readwrite");
                tx.objectStore("images").put(value, key);
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });
        };
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
        // 指定キーの画像データをIndexedDBから削除する。
        const idbDelete = async (key) => {
            const db = await openImageDb();
            return new Promise((resolve, reject) => {
                const tx = db.transaction("images", "readwrite");
                tx.objectStore("images").delete(key);
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });
        };
        // Data URL文字列をBlobへ変換する。
        const dataUrlToBlob = async (dataUrl) => {
            const response = await fetch(dataUrl);
            return response.blob();
        };
        // BlobをData URL文字列へ変換する。
        const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob);
        });
        // Canvasを指定バイト以下になるまで品質/解像度を段階的に圧縮する。
        const compressCanvas = async (canvas, mimeType, maxBytes) => {
            const isPng = mimeType === "image/png";
            let quality = isPng ? 1 : 0.9;
            let scale = 1;
            let workingCanvas = canvas;
            let blob = await new Promise((resolve) =>
                workingCanvas.toBlob(resolve, mimeType, quality)
            );

            // 圧縮のためにCanvasを縮小して再描画する。
            const resizeCanvas = (sourceCanvas, nextScale) => {
                const resized = document.createElement("canvas");
                resized.width = Math.max(1, Math.round(sourceCanvas.width * nextScale));
                resized.height = Math.max(1, Math.round(sourceCanvas.height * nextScale));
                const ctx = resized.getContext("2d");
                ctx.drawImage(sourceCanvas, 0, 0, resized.width, resized.height);
                return resized;
            };

            while (blob && blob.size > maxBytes) {
                if (!isPng && quality > 0.5) {
                    quality -= 0.1;
                    blob = await new Promise((resolve) =>
                        workingCanvas.toBlob(resolve, mimeType, quality)
                    );
                    continue;
                }
                scale *= 0.9;
                workingCanvas = resizeCanvas(workingCanvas, 0.9);
                blob = await new Promise((resolve) =>
                    workingCanvas.toBlob(resolve, mimeType, quality)
                );
                if (scale < 0.4) break;
            }

            return { blob, canvas: workingCanvas };
        };
        const previewUrls = [];
        // プレビュー画像要素に画像を反映し、表示状態を切り替える。
        const updateImagePreview = (id, src) => {
            const el = document.getElementById(id);
            if (!el) return;
            if (!src) {
                el.classList.remove("is-visible");
                el.removeAttribute("src");
                return;
            }
            el.src = src;
            el.classList.add("is-visible");
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
        // 既知の画像名ならassets配下の相対パスへ解決する。
        const toAssetPath = (fileName) => knownImages.has(fileName) ? `assets/images/${fileName}` : "";
        // 保存済みパスまたは画像名から表示用パスを解決する。
        const resolveImagePath = (pathValue, nameValue) => {
            if (pathValue && pathValue.startsWith("assets/")) return pathValue;
            if (nameValue && knownImages.has(nameValue)) return `assets/images/${nameValue}`;
            return "";
        };
        // 保存済みの値をフォーム要素へ復元する。
        const restoreValue = (id, value) => {
            const el = document.getElementById(id);
            if (!el || value === undefined || value === null) return;
            el.value = value;
        };
        const stored = sessionStorage.getItem("giftPreviewData");
        if (stored) {
            try {
                const data = JSON.parse(stored);
                restoreValue("giverName", data.giverName);
                restoreValue("receiverName", data.receiverName);
                restoreValue("giverLine1", data.giverLines?.[0] || "");
                restoreValue("giverLine2", data.giverLines?.[1] || "");
                restoreValue("giverLine3", data.giverLines?.[2] || "");
                restoreValue("giverLine4", data.giverLines?.[3] || "");
                restoreValue("giverLine5", data.giverLines?.[4] || "");
                restoreValue("giverLine6", data.giverLines?.[5] || "");
                restoreValue("senderReactionLine1", data.senderReactionLines?.[0] || "");
                restoreValue("senderReactionLine2", data.senderReactionLines?.[1] || "");
                restoreValue("senderReactionLine3", data.senderReactionLines?.[2] || "");
                restoreValue("receiverLine1", data.receiverLines?.[0] || "");
                restoreValue("receiverLine2", data.receiverLines?.[1] || "");
                restoreValue("receiverLine3", data.receiverLines?.[2] || "");
                restoreValue("receiverLine4", data.receiverLines?.[3] || "");
                restoreValue("receiverLine5", data.receiverLines?.[4] || "");
                restoreValue("receiverLine6", data.receiverLines?.[5] || "");
                restoreValue("reactionLine1", data.reactionLines?.[0] || "");
                restoreValue("reactionLine2", data.reactionLines?.[1] || "");
                restoreValue("reactionLine3", data.reactionLines?.[2] || "");
                restoreValue("authorName", data.authorName || "");

                if (data.giftType) {
                    const selected = document.querySelector(`input[name="giftType"][value="${data.giftType}"]`);
                    if (selected) selected.checked = true;
                }

                updateImagePreview(
                    "giverImagePreview",
                    data.giverImageData || resolveImagePath(data.giverImagePath, data.giverImage)
                );
                updateImagePreview(
                    "receiverImagePreview",
                    data.receiverImageData || resolveImagePath(data.receiverImagePath, data.receiverImage)
                );
                updateImagePreview(
                    "giftImagePreview",
                    data.giftImageData || resolveImagePath(data.giftImagePath, data.giftImage)
                );

                if (data.skipGiverImage) document.getElementById("skipGiverImage").checked = true;
                if (data.skipReceiverImage) document.getElementById("skipReceiverImage").checked = true;
                if (data.skipGiftImage) document.getElementById("skipGiftImage").checked = true;
            } catch {
                // ignore invalid cache
            }
        }

        (async () => {
            try {
                const giverDataUrl = sessionStorage.getItem("giverImageData");
                const receiverDataUrl = sessionStorage.getItem("receiverImageData");
                const giftDataUrl = sessionStorage.getItem("giftImageData");
                const giverStored = await idbGet("giverImage");
                const receiverStored = await idbGet("receiverImage");
                const giftStored = await idbGet("giftImage");
                if (giverStored && !giverDataUrl) {
                    const url = URL.createObjectURL(giverStored);
                    previewUrls.push(url);
                    updateImagePreview("giverImagePreview", url);
                }
                if (receiverStored && !receiverDataUrl) {
                    const url = URL.createObjectURL(receiverStored);
                    previewUrls.push(url);
                    updateImagePreview("receiverImagePreview", url);
                }
                if (giftStored && !giftDataUrl) {
                    const url = URL.createObjectURL(giftStored);
                    previewUrls.push(url);
                    updateImagePreview("giftImagePreview", url);
                }
            } catch {
                // ignore storage errors
            }
        })();

        if (giftForm) {
            giftForm.addEventListener("submit", (event) => {
                event.preventDefault();
                const skipGiftImageChecked = document.getElementById("skipGiftImage")?.checked || false;
                if (giftTypeRadios.length) {
                    giftTypeRadios[0].required = skipGiftImageChecked;
                }
                if (!giftForm.checkValidity()) {
                    giftForm.reportValidity();
                    return;
                }
                const formData = new FormData(giftForm);
                const giverImageFile = formData.get("giverImage");
                const receiverImageFile = formData.get("receiverImage");
                const giftImageFile = formData.get("giftImage");
                const giverImageName = giverImageFile?.name || "";
                const receiverImageName = receiverImageFile?.name || "";
                const giftImageName = giftImageFile?.name || "";
                const giverDataUrl = sessionStorage.getItem("giverImageData") || "";
                const receiverDataUrl = sessionStorage.getItem("receiverImageData") || "";
                const giftDataUrl = sessionStorage.getItem("giftImageData") || "";
                const payload = {
                    giverName: formData.get("giverName")?.toString().trim() || "",
                    giverImage: giverImageName,
                    giverImagePath: toAssetPath(giverImageName),
                    giverImageData: giverDataUrl,
                    skipGiverImage: document.getElementById("skipGiverImage")?.checked || false,
                    receiverName: formData.get("receiverName")?.toString().trim() || "",
                    receiverImage: receiverImageName,
                    receiverImagePath: toAssetPath(receiverImageName),
                    receiverImageData: receiverDataUrl,
                    skipReceiverImage: document.getElementById("skipReceiverImage")?.checked || false,
                    giftImage: giftImageName,
                    giftImagePath: toAssetPath(giftImageName),
                    giftImageData: giftDataUrl,
                    skipGiftImage: document.getElementById("skipGiftImage")?.checked || false,
                    authorName: formData.get("authorName")?.toString().trim() || "",
                    giftType: formData.get("giftType")?.toString() || "",
                    giverLines: [
                        formData.get("giverLine1")?.toString().trim() || "",
                        formData.get("giverLine2")?.toString().trim() || "",
                        formData.get("giverLine3")?.toString().trim() || "",
                        formData.get("giverLine4")?.toString().trim() || "",
                        formData.get("giverLine5")?.toString().trim() || "",
                        formData.get("giverLine6")?.toString().trim() || ""
                    ],
                    senderReactionLines: [
                        formData.get("senderReactionLine1")?.toString().trim() || "",
                        formData.get("senderReactionLine2")?.toString().trim() || "",
                        formData.get("senderReactionLine3")?.toString().trim() || ""
                    ],
                    receiverLines: [
                        formData.get("receiverLine1")?.toString().trim() || "",
                        formData.get("receiverLine2")?.toString().trim() || "",
                        formData.get("receiverLine3")?.toString().trim() || "",
                        formData.get("receiverLine4")?.toString().trim() || "",
                        formData.get("receiverLine5")?.toString().trim() || "",
                        formData.get("receiverLine6")?.toString().trim() || ""
                    ],
                    reactionLines: [
                        formData.get("reactionLine1")?.toString().trim() || "",
                        formData.get("reactionLine2")?.toString().trim() || "",
                        formData.get("reactionLine3")?.toString().trim() || ""
                    ]
                };
                // 送信時に画像入力の状態をIndexedDBへ同期する。
                const saveToDb = async () => {
                    if (giverDataUrl) {
                        await idbSet("giverImage", await dataUrlToBlob(giverDataUrl));
                    } else if (giverImageFile && giverImageFile.size) {
                        await idbSet("giverImage", giverImageFile);
                    } else {
                        await idbDelete("giverImage");
                    }

                    if (receiverDataUrl) {
                        await idbSet("receiverImage", await dataUrlToBlob(receiverDataUrl));
                    } else if (receiverImageFile && receiverImageFile.size) {
                        await idbSet("receiverImage", receiverImageFile);
                    } else {
                        await idbDelete("receiverImage");
                    }

                    if (giftDataUrl) {
                        await idbSet("giftImage", await dataUrlToBlob(giftDataUrl));
                    } else if (giftImageFile && giftImageFile.size) {
                        await idbSet("giftImage", giftImageFile);
                    } else {
                        await idbDelete("giftImage");
                    }
                };

                saveToDb().then(() => {
                    sessionStorage.setItem("giftPreviewData", JSON.stringify(payload));
                    window.location.href = "preview.html";
                });
            });
        }

        const cropperModal = document.getElementById("cropperModal");
        const cropperImage = document.getElementById("cropperImage");
        const cropperFrame = document.getElementById("cropperFrame");
        const cropperSlider = document.getElementById("cropperZoom");
        const cropperApply = document.getElementById("cropperApply");
        const cropperCancel = document.getElementById("cropperCancel");
        const cropperTitle = document.getElementById("cropperTitle");

        let cropperState = {
            target: "",
            image: null,
            scale: 1,
            offsetX: 0,
            offsetY: 0,
            dragStartX: 0,
            dragStartY: 0,
            dragging: false
        };

        // 画像入力とドロップゾーンの有効/無効状態を切り替える。
        const setImageInputState = (targetId, disabled) => {
            const input = document.getElementById(targetId);
            const zone = document.querySelector(`.drop-zone[data-target="${targetId}"]`);
            if (input) input.disabled = disabled;
            if (zone) zone.classList.toggle("is-disabled", disabled);
        };

        // 対象画像のsessionStorage/IndexedDB/プレビューをまとめてクリアする。
        const clearImageData = async (targetId) => {
            if (targetId === "giverImage") {
                sessionStorage.removeItem("giverImageData");
                await idbDelete("giverImage");
                updateImagePreview("giverImagePreview", "");
            } else if (targetId === "receiverImage") {
                sessionStorage.removeItem("receiverImageData");
                await idbDelete("receiverImage");
                updateImagePreview("receiverImagePreview", "");
            } else if (targetId === "giftImage") {
                sessionStorage.removeItem("giftImageData");
                await idbDelete("giftImage");
                updateImagePreview("giftImagePreview", "");
            }
        };

        // 画像トリミングモーダルを開き、対象画像を読み込む。
        const openCropper = (file, targetId) => {
            if (!file || !file.type.startsWith("image/")) return;
            cropperState.target = targetId;
            cropperState.scale = 1;
            cropperState.offsetX = 0;
            cropperState.offsetY = 0;
            cropperSlider.value = 1;
            const targetRatio = targetId === "giftImage" ? "1 / 1" : "4 / 5";
            cropperFrame.style.aspectRatio = targetRatio;
            if (targetId === "giverImage") {
                cropperTitle.textContent = "送るキャラ画像をトリミング";
            } else if (targetId === "receiverImage") {
                cropperTitle.textContent = "貰うキャラ画像をトリミング";
            } else {
                cropperTitle.textContent = "プレゼント画像をトリミング";
            }

            const reader = new FileReader();
            reader.onload = () => {
                cropperImage.src = reader.result;
                cropperState.image = new Image();
                cropperState.image.onload = () => {
                    cropperModal.classList.add("open");
                    requestAnimationFrame(() => {
                        fitImageToFrame();
                        updateCropperTransform();
                    });
                };
                cropperState.image.src = reader.result;
            };
            reader.readAsDataURL(file);
        };

        // 画像全体がトリミング枠を埋める初期スケールに合わせる。
        const fitImageToFrame = () => {
            if (!cropperState.image) return;
            const frameRect = cropperFrame.getBoundingClientRect();
            const scaleX = frameRect.width / cropperState.image.width;
            const scaleY = frameRect.height / cropperState.image.height;
            cropperState.scale = Math.max(scaleX, scaleY);
            cropperSlider.value = cropperState.scale;
            cropperState.offsetX = 0;
            cropperState.offsetY = 0;
        };

        // 現在の拡大率とオフセットをトリミング画像へ反映する。
        const updateCropperTransform = () => {
            cropperImage.style.transform = `translate(calc(-50% + ${cropperState.offsetX}px), calc(-50% + ${cropperState.offsetY}px)) scale(${cropperState.scale})`;
        };

        cropperSlider.addEventListener("input", () => {
            cropperState.scale = parseFloat(cropperSlider.value);
            updateCropperTransform();
        });

        cropperFrame.addEventListener("pointerdown", (event) => {
            cropperState.dragging = true;
            cropperState.dragStartX = event.clientX - cropperState.offsetX;
            cropperState.dragStartY = event.clientY - cropperState.offsetY;
            cropperFrame.setPointerCapture(event.pointerId);
        });

        cropperFrame.addEventListener("pointermove", (event) => {
            if (!cropperState.dragging) return;
            cropperState.offsetX = event.clientX - cropperState.dragStartX;
            cropperState.offsetY = event.clientY - cropperState.dragStartY;
            updateCropperTransform();
        });

        cropperFrame.addEventListener("pointerup", (event) => {
            cropperState.dragging = false;
            cropperFrame.releasePointerCapture(event.pointerId);
        });

        cropperCancel.addEventListener("click", () => {
            cropperModal.classList.remove("open");
        });

        cropperApply.addEventListener("click", async () => {
            if (!cropperState.image) return;
            const targetDataKey = cropperState.target === "giverImage"
                ? "giverImageData"
                : cropperState.target === "receiverImage"
                    ? "receiverImageData"
                    : "giftImageData";
            const frameRect = cropperFrame.getBoundingClientRect();
            const isGift = cropperState.target === "giftImage";
            const outputWidth = isGift ? 900 : 800;
            const outputHeight = isGift ? 900 : 1000;
            const canvas = document.createElement("canvas");
            canvas.width = outputWidth;
            canvas.height = outputHeight;
            const ctx = canvas.getContext("2d");
            const scale = cropperState.scale;
            const imageX = (frameRect.width / 2) - (cropperState.image.width * scale / 2) + cropperState.offsetX;
            const imageY = (frameRect.height / 2) - (cropperState.image.height * scale / 2) + cropperState.offsetY;
            if (!isGift) {
                ctx.fillStyle = "#000";
                ctx.fillRect(0, 0, outputWidth, outputHeight);
            }
            ctx.drawImage(
                cropperState.image,
                imageX * (outputWidth / frameRect.width),
                imageY * (outputHeight / frameRect.height),
                cropperState.image.width * scale * (outputWidth / frameRect.width),
                cropperState.image.height * scale * (outputHeight / frameRect.height)
            );
            const mimeType = isGift ? "image/png" : "image/jpeg";
            const { blob } = await compressCanvas(canvas, mimeType, 1024 * 1024);
            if (!blob) return;
            const dataUrl = await blobToDataUrl(blob);
            sessionStorage.setItem(targetDataKey, dataUrl);
            if (cropperState.target === "giverImage") {
                idbSet("giverImage", blob);
            } else if (cropperState.target === "receiverImage") {
                idbSet("receiverImage", blob);
            } else {
                idbSet("giftImage", blob);
            }
            updateImagePreview(
                cropperState.target === "giverImage"
                    ? "giverImagePreview"
                    : cropperState.target === "receiverImage"
                        ? "receiverImagePreview"
                        : "giftImagePreview",
                dataUrl
            );
            cropperModal.classList.remove("open");
        });

        let lastTargetId = "giverImage";

        // 入力/ドロップ/ペーストされた画像を対象ごとに処理する。
        const handleFile = (file, targetId) => {
            if (!file) return;
            const skipId = targetId === "giverImage"
                ? "skipGiverImage"
                : targetId === "receiverImage"
                    ? "skipReceiverImage"
                    : "skipGiftImage";
            const skipCheckbox = document.getElementById(skipId);
            if (skipCheckbox?.checked) return;
            openCropper(file, targetId);
        };

        // ドロップゾーンにクリック・D&D操作を紐づける。
        const setupDropZone = (zone) => {
            const targetId = zone.dataset.target;
            // ペースト先判定のため、最後に操作した画像入力を記録する。
            const markActive = () => {
                lastTargetId = targetId;
            };
            zone.addEventListener("click", () => {
                const input = document.getElementById(targetId);
                markActive();
                if (input) input.click();
            });
            zone.addEventListener("focus", markActive);
            zone.addEventListener("pointerdown", markActive);
            zone.addEventListener("dragenter", (event) => {
                event.preventDefault();
                markActive();
            });
            zone.addEventListener("dragover", (event) => {
                event.preventDefault();
                zone.classList.add("dragover");
            });
            zone.addEventListener("dragleave", () => {
                zone.classList.remove("dragover");
            });
            zone.addEventListener("drop", (event) => {
                event.preventDefault();
                zone.classList.remove("dragover");
                const dataTransfer = event.dataTransfer;
                const file = dataTransfer?.files?.[0]
                    || Array.from(dataTransfer?.items || [])
                        .find((item) => item.kind === "file" && item.type.startsWith("image/"))
                        ?.getAsFile();
                handleFile(file, targetId);
            });
        };

        document.querySelectorAll(".drop-zone").forEach(setupDropZone);

        document.addEventListener("dragover", (event) => {
            event.preventDefault();
        });

        document.addEventListener("drop", (event) => {
            event.preventDefault();
        });

        document.addEventListener("paste", (event) => {
            const items = event.clipboardData?.items || [];
            for (const item of items) {
                if (item.type.startsWith("image/")) {
                    const file = item.getAsFile();
                    const active = document.activeElement?.id;
                    const targetId = active === "receiverImage" || active === "giftImage" || active === "giverImage"
                        ? active
                        : lastTargetId;
                    handleFile(file, targetId);
                    break;
                }
            }
        });

        document.getElementById("giverImage")?.addEventListener("change", (event) => {
            const file = event.target.files?.[0];
            handleFile(file, "giverImage");
        });

        document.getElementById("receiverImage")?.addEventListener("change", (event) => {
            const file = event.target.files?.[0];
            handleFile(file, "receiverImage");
        });

        document.getElementById("giftImage")?.addEventListener("change", (event) => {
            const file = event.target.files?.[0];
            handleFile(file, "giftImage");
        });

        // 「画像を入力しない」チェックの挙動を対象入力へ紐づける。
        const bindSkipCheckbox = (checkboxId, targetId) => {
            const checkbox = document.getElementById(checkboxId);
            if (!checkbox) return;
            // チェック状態に応じて入力無効化とデータ削除を実行する。
            const update = () => {
                const disabled = checkbox.checked;
                setImageInputState(targetId, disabled);
                if (targetId === "giftImage" && giftTypeRadios.length) {
                    giftTypeRadios[0].required = disabled;
                }
                if (disabled) {
                    clearImageData(targetId);
                }
            };
            checkbox.addEventListener("change", update);
            update();
        };

        bindSkipCheckbox("skipGiverImage", "giverImage");
        bindSkipCheckbox("skipReceiverImage", "receiverImage");
        bindSkipCheckbox("skipGiftImage", "giftImage");

        // デモ動画モーダルの開閉と再生状態を制御する。
        const setupDemoPlayer = () => {
            if (!openDemoButton || !demoModalElement || !demoVideo || !window.bootstrap?.Modal) return;
            const demoModal = new window.bootstrap.Modal(demoModalElement);

            openDemoButton.addEventListener("click", () => {
                demoModal.show();
            });

            demoModalElement.addEventListener("shown.bs.modal", () => {
                demoVideo.currentTime = 0;
                demoVideo.play().catch(() => {
                    // autoplay restriction
                });
            });

            demoModalElement.addEventListener("hidden.bs.modal", () => {
                demoVideo.pause();
                demoVideo.currentTime = 0;
            });
        };

        setupDemoPlayer();

        window.addEventListener("beforeunload", () => {
            previewUrls.forEach((url) => URL.revokeObjectURL(url));
        });

























