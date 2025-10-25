import { ref, type Ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { type DataItem, type DataInfo, type LockStatus, type DataLabel, FileLabelStatus} from '@/api'
import { useUserStore } from './user'
import { useUiStateStore } from './uistate'

export const useDataStore = defineStore('dataStore', () => {
  const userStore = useUserStore();
  const uiStateStore = useUiStateStore();

  const dataItems: Ref<DataItem[]> = ref([]);
  const activeDataItem: Ref<DataItem | null> = ref(null);
  const activeDataInfo: Ref<DataInfo | null> = ref(null);
  const activeDataLabel: Ref<DataLabel | null> = ref(null);
  const activeDataLock: Ref<[boolean, LockStatus] | null> = ref(null);

  function resetActiveData() {
    activeDataItem.value = null;
    activeDataInfo.value = null;
    activeDataLabel.value = null;
    activeDataLock.value = null;
  }

  async function gotoGlobalDataIdx(idx: number) {
    const pageIdx = Math.floor(idx / uiStateStore.PAGE_SIZE);
    if (pageIdx < 0 || pageIdx >= uiStateStore.pageMax) {
      console.warn("global index out of range", idx);
      return;
    }
    if (pageIdx != uiStateStore.pageIndex) {
      uiStateStore.pageIndex = pageIdx;
      await updateIndex();
    }
    const localIdx = idx % uiStateStore.PAGE_SIZE;
    if (localIdx < dataItems.value.length) {
      await setActiveDataItem(dataItems.value[localIdx]!);
    }
    else {
      console.warn("local index out of range", localIdx, dataItems.value.length);
    }
  }

  async function updateIndex() {
    useUiStateStore().pageIndexLoading = true;
    try {
      const backend = userStore.backend;
      const nData = await backend.countData();
      uiStateStore.pageMax = Math.ceil(nData / uiStateStore.PAGE_SIZE);

      const dataList = await backend.listData(
        uiStateStore.pageIndex * uiStateStore.PAGE_SIZE,
        uiStateStore.PAGE_SIZE,
        {skipUserLock: userStore.user?.username} // pass the current username to skip the lock check
      )
      dataItems.value = dataList;
    }
    catch (e) { throw e; }
    finally {
      useUiStateStore().pageIndexLoading = false;
    }
  }

  async function unlockActiveDataItem() {
    if (activeDataItem.value) {
      const backend = userStore.backend;
      await backend.tryUnlock(activeDataItem.value);
    }
    else{
      console.warn("no active data item to unlock");
    }
  }

  async function refreshActiveDataItem() {
    if (activeDataItem.value) {
      const backend = userStore.backend;
      const newLabelStatus = await backend.getLabelStatus([activeDataItem.value.fileName], userStore.user!.username);
      activeDataItem.value.status = newLabelStatus[0]!;
    }
    // find the index of the active data item in the dataItems array
    const index = dataItems.value.findIndex(item => item.fileName === activeDataItem.value?.fileName);
    if (index >= 0) {
      if (activeDataItem.value) {
        // update the dataItems array with the new dataInfo
        dataItems.value[index]!.status = activeDataItem.value.status;
      }
    }
  }

  const refreshLabelStatus = async () => {
    const backend = userStore.backend;
    const labelStatus = await backend.getLabelStatus(
      dataItems.value.map(item => item.fileName),
      userStore.user!.username
    );
    for (let i = 0; i < dataItems.value.length; i++) {
      dataItems.value[i]!.status = labelStatus[i]!;
    }
  }

  // return if the lock is successful acquired, and the current lock status
  async function setActiveDataItem(item: DataItem): Promise<[boolean, LockStatus]> {
    uiStateStore.msg.reset();

    // first unlock the previous item if any
    unlockActiveDataItem();

    const backend = userStore.backend;

    const fsDocLink = "https://menxli.github.io/metadent-app/docs/setup-backend.html#prepare-files-for-labeling";

    const fn_fetchDataInfo = async () => {
      let dataInfo: DataInfo;
      try{ dataInfo = await backend.getDataInfo(item.fileName); }
      catch(e){
        uiStateStore.msg.set(
          `Info format error for ${item.fileName}. Please check metadata format.<br>` +
          `More information can be found in <a href="${fsDocLink}" style='color: blue'>the documentation</a>.`,
          'warning'
        );
        throw e;
      }
      return dataInfo;
    }

    const fn_fetchLock = async () => {
      return await backend.tryLock(item)
    }

    const fn_fetchDataLabel = async () => {
      return await backend.getLabel(item.fileName);
    }

    useUiStateStore().pageIndexLoading = true;
    let lockInfo: [boolean, LockStatus];
    let dataInfo: DataInfo;
    let dataLabel: DataLabel;
    try {
      if (! await backend.isInfoAvailable(item.fileName)) {
        uiStateStore.msg.set(
          `Data info not available for ${item.fileName}. Please check metadata directory configuration.<br>` +
          `More information can be found in <a href="${fsDocLink}" style='color: blue'>the documentation</a>.`,
          'error'
        );
        throw new Error("Data info not available for " + item.fileName);
      }
      [lockInfo, dataInfo, dataLabel] = await Promise.all([
        fn_fetchLock(),
        fn_fetchDataInfo(),
        fn_fetchDataLabel(),
      ]);
      // sync update
      console.log("set active data", item, dataInfo!, dataLabel!);
      activeDataItem.value = item;
      activeDataInfo.value = dataInfo;
      activeDataLabel.value = dataLabel;
      await refreshLabelStatus()
    }
    catch (e) { throw e; }
    finally {
      useUiStateStore().pageIndexLoading = false;
    }

    const [lockAcquired, lock] = lockInfo;
    activeDataLock.value = [lockAcquired, lock];
    if (lockAcquired) {
      console.debug("lock acquired", lock);
    }
    else {
      console.debug("lock not acquired, existing lock", lock);
    }
    return activeDataLock.value;
  }

  async function saveCurrentLabel() {
    console.log("try to save current label", activeDataLabel.value);
    if (activeDataItem.value && activeDataLabel.value) {
      const backend = userStore.backend;
      await backend.setLabel(activeDataItem.value.fileName, activeDataLabel.value, userStore.user!.username);
      await backend.unSkip(activeDataItem.value.fileName);
      console.log("label saved");
    }
  }

  async function skipActiveData(reason: string) {
    if (activeDataItem.value && activeDataLabel.value && reason) {
      const backend = userStore.backend;
      await backend.setSkip(activeDataItem.value.fileName, reason);
    }
  }

  async function unskipActiveData() {
    if (activeDataItem.value && activeDataLabel.value) {
      const backend = userStore.backend;
      await backend.unSkip(activeDataItem.value.fileName);
    }
  }

  async function loadNextDataItem() {

    async function _loadNextDataItem() {
      await refreshLabelStatus();
      if (activeDataItem.value) {
        let idx = dataItems.value.findIndex(item => item.fileName === activeDataItem.value!.fileName);
        while (idx < dataItems.value.length - 1) {
          idx++;
          const nextItem = dataItems.value[idx]!;
          if (nextItem.status == FileLabelStatus.UNLABELED) {
            return await setActiveDataItem(nextItem);
          }
          console.log("x")
        }
      }
      alert("No more unlabeled items on this page. ");
    }

    useUiStateStore().pageIndexLoading = true;
    try {
      _loadNextDataItem()
    }
    catch (e) { throw e; }
    finally {
      useUiStateStore().pageIndexLoading = false;
    }
  }

  watch(() => uiStateStore.pageIndex, updateIndex)
  return {
    dataItems, activeDataInfo, activeDataItem, activeDataLabel, activeDataLock,
    updateIndex,
    setActiveDataItem,
    gotoGlobalDataIdx,
    saveCurrentLabel,
    unlockActiveDataItem,
    skipActiveData,
    unskipActiveData,
    refreshActiveDataItem,
    loadNextDataItem,
    resetActiveData
  }

}, {
  persist: {
    pick: ['pageIndex'],
  }
})
