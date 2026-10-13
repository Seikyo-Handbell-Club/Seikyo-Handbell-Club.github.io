/* =====================================================
   ハンドベル部サイト・専用衣装獲得システム
   通常抽選はベルちゃん／チャイムくんの各54枠のみ。
   イベント衣装・シークレット衣装は通常抽選の対象外。
===================================================== */

const NORMAL_COSTUME_ID = {
  bell: /^bell_costume_slot_(?:0[1-9]|[1-4][0-9]|5[0-4])$/,
  chime: /^chime_costume_slot_(?:0[1-9]|[1-4][0-9]|5[0-4])$/
};

function getNormalCostumes(collectionItems, character) {
  const pattern = NORMAL_COSTUME_ID[character];
  if (!pattern) return [];
  return collectionItems.filter(item =>
    item && item.group === character && pattern.test(item.id) &&
    item.placeholder !== true && typeof item.src === "string" && item.src.length > 0
  );
}

export async function awardRandomCostumeOnPageOpen({
  db, ref, get, set,
  currentUser, profile, collectionItems,
  getCachedCollectionData, saveCollectionDataCache,
  renderCollection, updateCollectionMiniCount,
  collectionView, showCostumeGift
}) {
  if (!currentUser || !profile || !Array.isArray(collectionItems)) return null;

  try {
    const uid = currentUser.uid;
    const snapshot = await get(ref(db, `members/${uid}/collection`));
    const owned = snapshot.exists() && snapshot.val() && typeof snapshot.val() === "object"
      ? snapshot.val() : {};
    const character = profile.characterType === "chime" ? "chime" : "bell";
    const bellAvailable = getNormalCostumes(collectionItems, "bell");
    const chimeAvailable = getNormalCostumes(collectionItems, "chime");
    const bellUnowned = bellAvailable.filter(item => !owned[item.id]);
    const chimeUnowned = chimeAvailable.filter(item => !owned[item.id]);
    const bellComplete = bellAvailable.length >= 54 && bellUnowned.length === 0;
    const chimeComplete = chimeAvailable.length >= 54 && chimeUnowned.length === 0;

    // 片方のアレンジ衣装54種類をコンプリートしたら、もう片方の未取得衣装を優先して抽選。
    // 相手側をコンプリートするまで、ページを開くたびに相手側から1着獲得する。
    let targetCharacter = character;
    if (chimeComplete && bellUnowned.length > 0) targetCharacter = "bell";
    else if (bellComplete && chimeUnowned.length > 0) targetCharacter = "chime";

    const unowned = targetCharacter === "bell" ? bellUnowned : chimeUnowned;
    let selected = null;
    if (unowned.length > 0) {
      selected = unowned[Math.floor(Math.random() * unowned.length)];
      const record = {
        acquiredAt: Date.now(),
        source: targetCharacter !== character ? `${character}-complete-${targetCharacter}-guaranteed` : "costume-system-test"
      };
      await set(ref(db, `members/${uid}/collection/${selected.id}`), record);
      owned[selected.id] = record;
      if (typeof showCostumeGift === "function") showCostumeGift(targetCharacter, selected);
    }

    if (selected) {
      const cached = getCachedCollectionData() || {};
      Object.assign(cached, owned);
      saveCollectionDataCache(uid, cached);
    }
    if (collectionView && !collectionView.classList.contains("hidden") && typeof renderCollection === "function") {
      await renderCollection();
    }
    if (typeof updateCollectionMiniCount === "function") updateCollectionMiniCount();
    return selected ? { character: selected.group, costumeId: selected.id } : null;
  } catch (error) {
    console.error("専用衣装システムの獲得エラー:", error);
    return null;
  }
}
