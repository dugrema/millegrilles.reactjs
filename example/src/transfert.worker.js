import { expose } from 'comlink'
import { FiletransferDownloadClient, FiletransferUploadClient } from '@dugrema/millegrilles.reactjs'
expose({
    ...FiletransferDownloadClient,
    ...FiletransferUploadClient
})