import path from 'path'
import { openDB } from 'idb'
import { base64 } from "multiformats/bases/base64"

// import { dechiffrer } from '@dugrema/millegrilles.utiljs/src/chiffrage'

import { chiffrage } from './chiffrage'

const { dechiffrer, preparerDecipher } = chiffrage

var _urlDownload = '/collections/fichiers',
    _nomIdb = 'collections'

const CACHE_TEMP_NAME = 'fichiersDechiffresTmp',
      TAILLE_LIMITE_BLOCKCIPHER = 5 * 1024 * 1024,  // La limite de dechiffrage vient de tests sur iPhone 7
      DECHIFFRAGE_TAILLE_BLOCK = 256 * 1024,
      STORE_DOWNLOADS = 'downloads',
      EXPIRATION_CACHE_MS = 24 * 60 * 60 * 1000

// Globals
var _chiffrage = null

// Structure downloads : {}
var _downloadEnCours = null,
    _callbackEtatDownload = null

const STATUS_NOUVEAU = 1,
  STATUS_ENCOURS = 2,
  STATUS_SUCCES = 3,
  STATUS_ERREUR = 4

export function down_setNomIdb(nomIdb) {
  _nomIdb = nomIdb
}

export async function down_getEtatCourant() {
  const db = await ouvrirIdb()

  const store = db.transaction(STORE_DOWNLOADS, 'readonly').objectStore(STORE_DOWNLOADS)
  let cursor = await store.openCursor()

  const downloads = []

  while(cursor) {
    const {key, value} = cursor
    // console.log(key, value)
    downloads.push(value)
    cursor = await cursor.continue()
  }

  // Trier pending, completes par date queuing
  downloads.sort(trierPending)

  const etat = {
      downloads,
      downloadEnCours: _downloadEnCours,
  }
  // console.debug("Retourner etat : %O", etat)
  return etat
}

export async function down_ajouterDownload(fuuid, opts) {
  opts = opts || {}
  // Note: opts doit avoir iv, tag et password/passwordChiffre pour les fichiers chiffres
  const url = path.join(_urlDownload, ''+fuuid)  // Peut etre override dans opts

  // console.debug("ajouterDownload %s, %O", fuuid, opts)

  const infoDownload = {
    url,
    taille: '',
    conserver: false,  // Indique de conserver le fichier dans un cache longue duree (offline viewing)
    ...opts,  // Overrides et params

    fuuid,
    hachage_bytes: fuuid,  // Cle de la collection

    annuler: false,
    status: STATUS_NOUVEAU,
    dateQueuing: new Date(),
    dateComplete: '',
  }

  // console.debug("ajouterDownload push %O", infoDownload)

  const db = await ouvrirIdb()
  await db.transaction(STORE_DOWNLOADS, 'readwrite')
    .objectStore(STORE_DOWNLOADS)
    .put(infoDownload)

  traiterDownloads()
}

async function traiterDownloads() {
  if(_downloadEnCours) return  // Rien a faire

  const progressCb = (loaded, size, flags) => {
    flags = flags || {}
    emettreEtat({loaded, size, ...flags})
  }

  let complete = ''
  let downloadsPending = await getDownloadsPending()
  //for(_downloadEnCours = downloadsPending.shift(); _downloadEnCours; _downloadEnCours = downloadsPending.shift()) {
  while(downloadsPending.length > 0) {
      _downloadEnCours = downloadsPending.shift()
      // console.debug("Traitement fichier %O", _downloadEnCours)
      
      //_downloadEnCours.status = STATUS_ENCOURS
      await majDownload(_downloadEnCours.hachage_bytes, {status: STATUS_ENCOURS})
      emettreEtat({complete}).catch(err=>(console.warn("Erreur maj etat : %O", err)))
      
      try {
          // Download le fichier.
          await downloadCacheFichier(_downloadEnCours, {progressCb})
          emettreEtat({fuuidReady: _downloadEnCours.fuuid}).catch(err=>(console.warn("Erreur maj etat apres download complet : %O", err)))
      } catch(err) {
          console.error("Erreur GET fichier : %O (downloadEnCours : %O)", err, _downloadEnCours)
          _downloadEnCours.status = STATUS_ERREUR
          await majDownload(_downloadEnCours.hachage_bytes, {complete: true, status: STATUS_ERREUR, dateComplete: new Date()})
      } finally {
          //if(!_downloadEnCours.annuler) {
              // _downloadsCompletes.push(_downloadEnCours)
          //}
          complete = _downloadEnCours.correlation
          // _downloadEnCours.complete = true
          if(_downloadEnCours.status !== STATUS_ERREUR) {
            await majDownload(_downloadEnCours.hachage_bytes, {
              complete: true, 
              status: STATUS_SUCCES, 
              dateComplete: new Date(),
              annuler: _downloadEnCours.annuler,
            })
          }

          _downloadEnCours = null
          emettreEtat({complete}).catch(err=>(console.warn("Erreur maj etat : %O", err)))
      }

      downloadsPending = await getDownloadsPending()
  }

}

async function getDownloadsPending() {
  const db = await ouvrirIdb()
  const store = db.transaction(STORE_DOWNLOADS, 'readonly').objectStore(STORE_DOWNLOADS)
  let cursor = await store.openCursor()

  const downloadsPending = []
  while(cursor) {
    const { key, value } = cursor
    // console.log(key, value)
    if(value.status === STATUS_NOUVEAU) {
      downloadsPending.push(value)
    }
    cursor = await cursor.continue()
  }

  // Trier par dateQueining
  downloadsPending.sort(trierPending)
  return downloadsPending
}

function trierPending(a, b) {
  if(a===b) return 0
  const aDate = a.dateQueuing, bDate = b.dateQueuing
  return aDate.getTime() - bDate.getTime()
}

async function majDownload(hachage_bytes, value) {
  const db = await ouvrirIdb()
  const data = await db.transaction(STORE_DOWNLOADS, 'readonly').objectStore(STORE_DOWNLOADS).get(hachage_bytes)
  await db.transaction(STORE_DOWNLOADS, 'readwrite')
    .objectStore(STORE_DOWNLOADS)
    .put({...data, ...value})
}

/** Fetch fichier, permet d'acceder au reader */
async function fetchAvecProgress(url, opts) {
  opts = opts || {}
  const progressCb = opts.progressCb,
        downloadEnCours = opts.downloadEnCours,
        DEBUG = opts.DEBUG

  var dataProcessor = opts.dataProcessor

  const reponse = await fetch(url)

  // if(DEBUG) console.debug("Reponse object : %O", reponse)
  const reader = reponse.body.getReader()
  const contentLength = Number(reponse.headers.get('Content-Length'))

  progressCb(0, contentLength, {})

  if(dataProcessor && dataProcessor.start) {
    // Initialiser le data processor au besoin
    const actif = await dataProcessor.start(reponse)
    if(!actif) dataProcessor = null
  }

  const downloadEnvironment = {
    dataProcessor,  // Si present, permet d'appliquer un traitement sur les donnes au vol
    downloadEnCours,  // .annuler === true indique que le client veut annuler le download
    progressCb,
    DEBUG,
  }

  const downloadStream = _creerDownloadStream(reader, contentLength, downloadEnvironment)

  return {
    reader: downloadStream,
    headers: reponse.headers,
    status: reponse.status,
  }

}

function _creerDownloadStream(reader, contentLength, opts) {
  opts = opts || {}

  const downloadEnCours = opts.downloadEnCours || {},
        dataProcessor = opts.dataProcessor,
        DEBUG = opts.DEBUG

  const {fuuid, filename} = downloadEnCours

  const progressCb = opts.progressCb || function(){}  // Default fonction sans effet

  if(typeof(contentLength) === 'string') contentLength = Number(contentLength)

  var receivedLength = 0
  var done = false

  return new ReadableStream({
    start: controller => {
      if(DEBUG) console.debug("start _creerDownloadStream")
    },
    pull: async controller => {
      if(done) {
        if(DEBUG) console.debug("_creerDownloadStream - done deja sette, termine")
        controller.close()
        progressCb(contentLength, contentLength, {})  // Complet
        return
      }

      if(downloadEnCours && downloadEnCours.annuler) {
        throw new Error("Usager a annule le transfert")
      }
      progressCb(receivedLength, contentLength, {flag: 'lecture'})  // Complet
      const {done: _done, value} = await reader.read()
      progressCb(receivedLength, contentLength, {flag: '', message: value?`Lu ${value.length}`:'Lecture null'})  // Complet

      if(DEBUG) console.debug("_creerDownloadStream pull (done: %s) value = %O", _done, value)
      if(_done) {
        done = true
        if(dataProcessor) {
          if(DEBUG) console.debug("_creerDownloadProcess termine, on fait dataProcessor.finish()")
          const value = await dataProcessor.finish()
          if(value && value.length > 0) {
            controller.enqueue(value)
          } else {
            controller.close()
            progressCb(contentLength, contentLength, {})  // Complet
          }
        } else {
          controller.close()
          progressCb(contentLength, contentLength, {})  // Complet
        }
        return
      }

      // Verifier taille recue, traiter en petits blocks
      for(let _position=0; _position < value.length; _position += DECHIFFRAGE_TAILLE_BLOCK) {
        // Traitement block

        if(downloadEnCours) {
          // Donner une chance d'intercepter l'evenement
          await new Promise(resolve=>setTimeout(resolve, 1))
          if(downloadEnCours.annuler) {
            throw new Error("Usager a annule le transfert")
          }
        }

        const positionFin = Math.min(_position + DECHIFFRAGE_TAILLE_BLOCK, value.length)
        var sousBlock = value.slice(_position, positionFin)

        if(dataProcessor) {
          if(DEBUG) console.debug("Dechiffrer")
          try {
            progressCb(receivedLength, contentLength, {
              flag: 'dechiffrage', message: `Dechiffrage ${sousBlock.length}, position : ${receivedLength}`
            })
            sousBlock = await dataProcessor.update(sousBlock)
            progressCb(receivedLength, contentLength, {flag: ''})
          } catch(err) {
            if(DEBUG) console.error("Erreur dechiffrage, %O", err)
            throw err
          }
          if(DEBUG) console.debug("Value chiffree : %O", sousBlock)
        }

        receivedLength += sousBlock.length
        if(DEBUG) console.debug(`Recu ${receivedLength} / ${contentLength}`)
        progressCb(receivedLength, contentLength, {})

        controller.enqueue(sousBlock)
      }
    }
  })

}

async function preparerDataProcessor(iv, tag, opts) {
  opts = opts || {}
  const DEBUG = opts.DEBUG || false
  let {password, passwordChiffre} = opts
  const tailleLimiteSubtle = opts.tailleLimiteSubtle || TAILLE_LIMITE_BLOCKCIPHER
  const clePriveePem = opts.clePriveePem
  let blockCipher = null

  if(!password && !passwordChiffre) throw new Error("Il faut fournir opts.password ou opts.passwordChiffre")
  
  // Charger cle privee subtle, dechiffrer mot de passe
  if(!password) {
    // Dechiffrage du password - agit comme validation si subtle est utilise (on ne sauvegarde pas le password)
    password = await _chiffrage.dechiffrerCleSecrete(passwordChiffre)
  } else if(typeof(password) === 'string') {
    password = base64.decode(password)
  }

  let estActif = false
  const dataProcessor = {
    start: async response => {
      // On active le blockCipher si le fichier depasse le seuil pour utiliser subtle
      const size = Number(response.headers.get('content-length'))
      if(size > tailleLimiteSubtle) {
        if(DEBUG) console.debug("Fichier taille %d, on va utiliser le block cipher javascript pur", size)
        estActif = true
        blockCipher = await preparerDecipher(password, iv, {tag})
      } else {
        if(DEBUG) console.debug("Fichier taille %d sous seuil, on utilise subtle pour dechiffrer", size)
        // Retourner false, indique que le dataProcessor est inactif
      }
      return estActif
    },
    update: data => {
      if(!blockCipher) throw new Error("Data processor est inactif")
      return blockCipher.update(data)
    },
    finish: () => {
      if(!blockCipher) throw new Error("Data processor est inactif")
      return blockCipher.finalize()
    },
    password,
    estActif: () => estActif,
  }

  return dataProcessor
}

/** Download un fichier, effectue les transformations (e.g. dechiffrage) et
 *  conserve le resultat dans cache storage */
async function downloadCacheFichier(downloadEnCours, opts) {
  opts = opts || {}
  const progressCb = opts.progressCb || function() {}  // Par defaut fonction vide

  // console.debug("downloadCacheFichier %O, Options : %O", downloadEnCours, opts)
  const DEBUG = opts.DEBUG || false

  var dataProcessor = null
  const {fuuid, url, filename, mimetype, iv, tag, password, passwordChiffre} = downloadEnCours
  if(iv && tag && (password || passwordChiffre)) {
    dataProcessor = await preparerDataProcessor(iv, tag, {password, passwordChiffre})
  }

  let urlDownload = new URL(_urlDownload)
  try {
    // Verifier si URL fourni est valide/global
    urlDownload = new URL(url)
  } catch(err) {
    // Ajouter url au path
    urlDownload.pathname = path.join(urlDownload.pathname, url)
  }
  // console.debug("URL de download de fichier : %O", urlDownload)

  let pathname
  try {
    const {reader: stream, headers, status} = await fetchAvecProgress(
      urlDownload,
      {progressCb, dataProcessor, DEBUG}
    )

    if(DEBUG) console.debug("Stream url %s recu (status: %d): %O", url, status, stream)
    if(status>299) {
      const err = new Error(`Erreur download fichier ${url} (code ${status})`)
      err.status = status
      throw err
    }

    const size = Number(headers.get('content-length'))
    const headerList = await Promise.all(headers.entries())
    const headersModifies = new Headers()
    if(DEBUG) console.debug("Headers originaux avant dechiffrage : %O", headerList)
    for(let idx in headerList) {
      const header = headerList[idx]
      headersModifies.set(header[0], header[1])
    }
    if(mimetype) {
      headersModifies.set('content-type', mimetype)
    }
    if(filename) {
      headersModifies.set('content-disposition', `attachment; filename="${encodeURIComponent(filename)}"`)
    }

    let blockCipher = dataProcessor && dataProcessor.estActif()

    var response = null
    if(blockCipher) {  // size > TAILLE_LIMITE_BLOCKCIPHER) {
      // Download et dechiffrage en stream
      if(DEBUG) console.debug("Dechiffrage mode stream")
      response = new Response(stream, {headers: headersModifies, status})
    } else {
      if(DEBUG) console.debug("Creation buffer %d bytes pour cipher/subtle", size)
      var buffer = new Uint8Array(size)
      var position = 0
      const reader = stream.getReader()
      while(downloadEnCours.annuler !== true) {
        const {done, value} = await reader.read()
        if(DEBUG) console.debug("TransfertFichiers.worker reader : done=%s, value=%O", done, value)
        if(done) break
        buffer.set(value, position)
        position += value.length
      }

      if(dataProcessor && dataProcessor.password) {
        // On avait un processor, finir le dechiffrage
        if(DEBUG) console.debug("Dechiffrer apres buffering")
        progressCb(size-1, size, {flag: 'Dechiffrage en cours'})
        // if(!password)
        // password = await _chiffrage.dechiffrerCleSecrete(passwordChiffre)
        buffer = await dechiffrer(buffer, dataProcessor.password, iv, tag)
        console.debug("Dechiffrage avec data processor termine")
        progressCb(size, size, {flag: 'Mise en cache'})
      }
      response = new Response(buffer, {headers: headersModifies, status})
    }

    if(downloadEnCours.annuler) throw new Error("Download annule")

    if(DEBUG) console.debug("Conserver %s dans cache", url)
    if(fuuid) {
      pathname = '/' + fuuid
    } else if(!pathname) {
      pathname = url
      try { pathname = new URL(url).pathname } catch(err) {
        if(DEBUG) console.debug("Pathname a utiliser pour le cache : %s", pathname)
      }
    }
    if(DEBUG) console.debug("Fuuid a mettre dans le cache : %s", pathname)

    // console.debug("Caches : %O, CacheStorage: %O", caches, CacheStorage)
    const cache = await caches.open(CACHE_TEMP_NAME)
    if(DEBUG) console.debug("Cache instance : %O", cache)
    const promiseCache = cache.put(pathname, response)

    // Attendre que le download soit termine
    if(DEBUG) console.debug("Attendre que le download soit termine, response : %O", response)

    await promiseCache
    progressCb(size, size, {})
    if(DEBUG) console.debug("Caching complete")
  } catch(err) {
    console.error("Erreur download/processing : %O", err)
    if(progressCb) progressCb(-1, -1, {flag: 'Erreur', err: ''+err, stack: err.stack})
    try {
      const cache = await caches.open(CACHE_TEMP_NAME)
      cache.delete(pathname)
    } catch(err) {console.warn("Erreur suppression cache %s : %O", pathname, err)}
    throw err
  } finally {
    downloadEnCours.termine = true
    // _downloadEnCours = null
  }
}

async function emettreEtat(flags) {
  flags = flags || {}
  if(_callbackEtatDownload) {

      if(_downloadEnCours) {
          flags.enCoursFuuid = _downloadEnCours.fuuid
          flags.enCoursTaille = isNaN(_downloadEnCours.taille)?0:_downloadEnCours.taille
          flags.enCoursLoaded = isNaN(_downloadEnCours.loaded)?0:_downloadEnCours.loaded
      }

      const loadedEnCours = flags.loaded || flags.enCoursLoaded

      // Calculer information pending
      const etatCourant = await down_getEtatCourant()
      let {total, loaded, pending} = etatCourant.downloads.reduce((compteur, item)=>{
        const { taille, complete, status } = item
        if(complete) compteur.loaded += taille
        else {
          compteur.pending += 1
          if(status === STATUS_ENCOURS && item.hachage_bytes === _downloadEnCours.fuuid) {
            compteur.loaded += loadedEnCours
          }
        }
        compteur.total += taille
        return compteur
      }, {total: 0, loaded: 0, pending: 0})

      flags.total = total

      const pctFichiersEnCours = Math.floor(loaded * 100 / total)
      // console.debug("Emettre etat : pending %O, pctFichiersEnCours : %O, flags: %O", pending, pctFichiersEnCours, flags)

      _callbackEtatDownload(
          pending,
          pctFichiersEnCours,
          flags,
      )
  }
}

export async function down_annulerDownload(fuuid) {

  const etatAnnule = {complete: true, status: STATUS_ERREUR, annuler: true, dateComplete: new Date()}

  if(!fuuid) {
    // console.debug("Annuler tous les downloads")
    await majIdb(item=>item.status===STATUS_NOUVEAU, etatAnnule)
    if(_downloadEnCours) _downloadEnCours.annuler = true
  } else {
    // console.warn("Annuler download %s", fuuid)
    if(_downloadEnCours && _downloadEnCours.fuuid === fuuid) {
      _downloadEnCours.annuler = true
    } else {
      await majDownload(fuuid, etatAnnule)
    }
  }

  // Met a jour le client
  emettreEtat()
}

/** Maj des downloads avec filtre/values */
async function majIdb(filtre, values) {
  const db = await ouvrirIdb()
  const store = db.transaction(STORE_DOWNLOADS, 'readwrite').objectStore(STORE_DOWNLOADS)
  let cursor = await store.openCursor()
  while(cursor) {
    const { key, value } = cursor
    if(filtre(value)) {
      cursor.update({...value, ...values})
    }
    cursor = await cursor.continue()
  }
}

function ouvrirIdb() {
  return openDB(_nomIdb)
}

/** Set le chiffrage worker */
export function down_setChiffrage(chiffrage) {
  _chiffrage = chiffrage
}

export function down_setCallbackDownload(cb) {
  _callbackEtatDownload = cb
}

export function down_setUrlDownload(urlDownload) {
  _urlDownload = urlDownload
}

export function down_setCertificatCa(certificat) {
  // _certificatCa = certificat
}

export async function down_retryDownload(fuuid) {
  const [cache, db] = await Promise.all([caches.open(CACHE_TEMP_NAME), ouvrirIdb()])

  const data = await db.transaction(STORE_DOWNLOADS, 'readonly').objectStore(STORE_DOWNLOADS).get(fuuid)
  await db.transaction(STORE_DOWNLOADS, 'readwrite')
    .objectStore(STORE_DOWNLOADS)
    .put({
      ...data, 
      status: 1, 
      err: null, 
      annuler: false, 
      complete: false, 
      dateComplete: '', 
      dateQueuing: new Date(),
    })
  
  try {
    await cache.delete('/' + fuuid)
  } catch(err) {
    console.debug("Erreur suppression cache : %O", err)
  }

  // Demarrer download
  traiterDownloads()
}

export async function down_supprimerDownloads(params) {
  params = params || {}
  const { hachage_bytes, completes, filtre } = params

  const [cache, db] = await Promise.all([caches.open(CACHE_TEMP_NAME), ouvrirIdb()])
  if(hachage_bytes) {
    // console.debug("Supprimer download/cache pour %s", hachage_bytes)
    const store = db.transaction(STORE_DOWNLOADS, 'readwrite').objectStore(STORE_DOWNLOADS)
    await store.delete(hachage_bytes)
    await cache.delete('/' + hachage_bytes)
  } else if(completes === true || filtre) {
    const verifierItem = params.filtre?params.filtre:value=>value.complete
    // Supprimer tout les downloads completes
    // console.debug("down_supprimerDownloads: ouvrir curseur readwrite")
    const store = db.transaction(STORE_DOWNLOADS, 'readwrite').objectStore(STORE_DOWNLOADS)
    let cursor = await store.openCursor()
    while(cursor) {
      const { key, value } = cursor
      try {
        if(verifierItem(value)) {
          cache.delete('/' + value.hachage_bytes).catch(err=>{console.warn("Erreur suppression cache entry %s : %O", value.hachage_bytes, err)})
          await cursor.delete()
        }
      } catch(err) {
        console.warn("Erreur suppression entree cache %s : %O", key, err)
      }
      cursor = await cursor.continue()
    }
  }
  // console.debug("down_supprimerDownloads: fermer curseur readwrite")

  // Met a jour le client
  emettreEtat()
}

/** Nettoie les entrees dans le cache de download qui ne correspondent a aucune entree de la IndexedDB */
export async function cleanupCacheOrphelin() {
  const [cache, db] = await Promise.all([caches.open(CACHE_TEMP_NAME), ouvrirIdb()])
  const keysCache = await cache.keys()
  const dbKeys = await db.transaction(STORE_DOWNLOADS, 'readonly').objectStore(STORE_DOWNLOADS).getAllKeys()
  // console.debug("DB Keys : %O", dbKeys)

  for(let idx in keysCache) {
    const req = keysCache[idx]
    // console.debug("KEY %s", req.url)
    const urlKey = new URL(req.url)
    const fuuid = urlKey.pathname.split('/').pop()
    // console.debug("FUUID : %O", fuuid)
    if(!dbKeys.includes(fuuid)) {
      // console.debug("Cle cache inconnue, on va supprimer %s", fuuid)
      cache.delete(req).catch(err=>{console.warn("Erreur suppression entree cache %s", fuuid)})
    }
  }

}

/** Effectue l'entretie du cache et IndexedDb */
export async function down_entretienCache() {
  // console.debug("Entretien cache/idb de download")
  
  // Cleanup fichiers downloades de plus de 24h
  const dateExpiration = new Date().getTime() - EXPIRATION_CACHE_MS
  // const dateExpiration = new Date().getTime() - (60 * 1000)
  await down_supprimerDownloads({
    filtre: item => item.dateComplete.getTime() < dateExpiration
  })
  
  // Cleanup entrees de download cache inutilisees
  await cleanupCacheOrphelin()
}

// comlinkExpose({
//   fetchAvecProgress,
//   getEtatCourant,
//   ajouterDownload,  
//   setChiffrage,
//   annulerDownload,
//   setCallbackDownload,
// })
