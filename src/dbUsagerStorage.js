const DB_NAME = 'millegrilles',
      STORE_USAGERS = 'usagers'
      // STORE_CLES_DECHIFFREES = 'clesDechiffrees'

export function getListeUsagers() {
    const localStorage = window.localStorage
    const nbKeys = window.localStorage.length
    const usagers = []
    const prefix = [DB_NAME, STORE_USAGERS].join('.') + '.'
    for(let i=0; i<nbKeys; i++) {
        const keyName = localStorage.key(i)
        if(keyName.startsWith(prefix)) {
            const usager = keyName.split('.').pop()
            usagers.push(usager)
        }
    }
    return usagers
}

function getUsager(nomUsager) {
    const keyStorage = [DB_NAME, STORE_USAGERS, nomUsager].join('.')
    let valueStorage = window.localStorage.getItem(keyStorage)
    if(valueStorage) valueStorage = JSON.parse(valueStorage)
    return valueStorage
}

export function updateUsager(nomUsager, params, _opts) {
    let usager = getUsager(nomUsager)
    if(!usager) usager = {}
    const updateUsager = {...usager, ...params, nomUsager}
    const keyStorage = [DB_NAME, STORE_USAGERS, nomUsager].join('.')
    const valueStorage = JSON.stringify(updateUsager)
    return window.localStorage.setItem(keyStorage, valueStorage)
}

export function supprimerUsager(nomUsager) {
    const keyStorage = [DB_NAME, STORE_USAGERS, nomUsager].join('.')
    return window.localStorage.removeItem(keyStorage)
}
