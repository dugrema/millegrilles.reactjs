import * as dbUsagerIndexedDb from './dbUsagerIndexedDb'
import * as dbUsagerStorage from './dbUsagerStorage'

let _dao = null,
    _ready = false

const FORCE_LOCALSTORAGE = false

export function init() {

    // DEBUG
    if(FORCE_LOCALSTORAGE) { 
        console.warn("usagerDao init avec FORCE_LOCALSTORAGE=true")
        _dao = dbUsagerStorage
        _ready = true
        return Promise.resolve(_ready)
    }

    const promise = new Promise(async (resolve, reject) => {
        // Detecter si idb est disponible, fallback sur localstorage
        try {
            await dbUsagerIndexedDb.getListeUsagers()  // Test, lance une exception si echec
            _dao = dbUsagerIndexedDb
            _ready = true
        } catch(err) {
            if(window.localStorage) {
                console.info("IndexedDB non disponible, fallback sur localStorage (err: %s)", ''+err)
                _dao = dbUsagerStorage
                _ready = true
            } else {
                console.error("Storage non disponible")
                _ready = false
                return reject(err)
            }
        }
        resolve(_ready)
    })

    _ready = promise

    return promise
}

init()  // Detection initiale

export function ready() {
    if(!_ready) return false
    return _ready
}

export async function getListeUsagers(...args) {
    if(_ready === false) throw new Error("usagerDao pas initialise")
    await _ready
    return _dao.getListeUsagers(...args)
}

export async function getUsager(...args) {
    if(_ready === false) throw new Error("usagerDao pas initialise")
    await _ready
    return _dao.getUsager(...args)
}

export async function updateUsager(...args) {
    if(_ready === false) throw new Error("usagerDao pas initialise")
    await _ready
    return _dao.updateUsager(...args)
}

export async function supprimerUsager(...args) {
    if(_ready === false) throw new Error("usagerDao pas initialise")
    await _ready
    return _dao.supprimerUsager(...args)
}

export async function saveCleDechiffree(...args) {
    if(_ready === false) throw new Error("usagerDao pas initialise")
    await _ready
    return _dao.saveCleDechiffree(...args)
}

export async function getCleDechiffree(...args) {
    if(_ready === false) throw new Error("usagerDao pas initialise")
    await _ready
    return _dao.getCleDechiffree(...args)
}

export async function entretienCache(...args) {
    if(_ready === false) throw new Error("usagerDao pas initialise")
    await _ready
    return _dao.entretienCache(...args)
}

export async function clearClesDechiffrees(...args) {
    if(_ready === false) throw new Error("usagerDao pas initialise")
    await _ready
    return _dao.clearClesDechiffrees(...args)
}

export async function clearCertificatUsager(...args) {
    if(_ready === false) throw new Error("usagerDao pas initialise")
    await _ready
    return _dao.clearCertificatUsager(...args)
}