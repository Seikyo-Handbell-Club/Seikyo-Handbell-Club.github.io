/* =====================================================
   ハンドベル部サイト・専用衣装獲得システム
   テストモード：ログイン後、ページを開くたびに
   選択中キャラクターの未取得衣装を1着獲得。
   既存のシークレット衣装抽選とは独立して動作します。
===================================================== */

export async function awardRandomCostumeOnPageOpen({
  db,
  ref,
  get,
  set,
  currentUser,
  profile,
  collectionItems,
  getCachedCollectionData,
  saveCollectionDataCache,
  renderCollection,
  updateCollectionMiniCount,
  collectionView,
  showCostumeGift
}) {
  if (!currentUser || !profile || !Array.isArray(collectionItems)) return null;

  // 今のキャラクター設定に対応する通常衣装だけを抽選対象にする。
  const character = profile.characterType === "chime" ? "chime" : "bell";
  const group = character;
  const available = collectionItems.filter(item =>
    item && item.group === group && item.placeholder !== true &&
    typeof item.id === "string" && typeof item.src === "string"
  );
  if (!available.length) return null;

  try {
    const uid = currentUser.uid;
    const collectionRef = ref(db, `members/${uid}/collection`);
    const snapshot = await get(collectionRef);
    const owned = snapshot.exists() && snapshot.val() && typeof snapshot.val() === "object"
      ? snapshot.val()
      : {};

    // 所持済みを除外し、重複獲得を防ぐ。
    const unowned = available.filter(item => !owned[item.id]);
    if (!unowned.length) return null;

    const selected = unowned[Math.floor(Math.random() * unowned.length)];
    const record = { acquiredAt: Date.now(), source: "costume-system-test" };
    await set(ref(db, `members/${uid}/collection/${selected.id}`), record);

    const cached = getCachedCollectionData() || {};
    cached[selected.id] = record;
    saveCollectionDataCache(uid, cached);

    if (collectionView && !collectionView.classList.contains("hidden")) {
      await renderCollection();
    }
    if (typeof updateCollectionMiniCount === "function") updateCollectionMiniCount();

    // テスト獲得時も、ユーザーに衣装獲得演出を表示する。
    if (typeof showCostumeGift === "function") {
      showCostumeGift(character, selected);
    }

    console.info("衣装テスト獲得:", character, selected.id);
    return { character, costumeId: selected.id };
  } catch (error) {
    console.error("専用衣装システムの獲得エラー:", error);
    return null;
  }
}
