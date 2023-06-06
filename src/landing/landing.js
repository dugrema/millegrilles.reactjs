// Utilitaires pour plugin millegrilles-landing
import axios from 'axios'
import pako from 'pako'

/**
 * Utiliser pour recuperer un token
 * @param {Object} config Configuration de l'application (dict json avec {application_id, fiche_url, idmg})
 * @param {Object} opts : {urlConnexion: url de la connexion (optionnel)}
 * @returns {string} Token JWT a utiliser pour submit
 */
export async function getToken(config, opts) {
    opts = opts || {}

    const { application_id } = config
    let urlConnexion = null
    if(opts.urlConnexion) urlConnexion = new URL(opts.urlConnexion)
    else {
        urlConnexion = new URL(window.location.href)
        if(opts.module) urlConnexion.pathname = opts.module
        else urlConnexion.pathname = 'landing'
    }

    // Generer nouveau token
    const urlToken = new URL(urlConnexion.href)
    urlToken.pathname = urlToken.pathname + '/public/token'
    urlToken.searchParams.set('application_id', application_id)

    const reponse = await axios.get(urlToken.href)
    const data = reponse.data
    return data
}

async function chiffrerMessage(workers, certifcatsChiffragePem, from, content, opts) {
    opts = opts || {}

    const identificateurs_document = opts.identificateurs_document || {}
    const domaine = opts.domaine || 'Landing'

    const { chiffrage } = workers
    const champsOptionnels = ['subject', 'to']
    const message = { from, content }
    if(opts.files) message.files = opts.files
    champsOptionnels.forEach(nomChamp=>{
        if(opts[nomChamp]) message[nomChamp] = opts[nomChamp]
    })

    // Compresser le message en gzip
    let messageBytes = JSON.stringify(message)
    messageBytes = pako.deflate(new TextEncoder().encode(messageBytes))

    // Chiffrer le message 
    const messageChiffre = await chiffrage.chiffrerDocument(
        messageBytes, domaine, certifcatsChiffragePem, 
        {DEBUG: false, identificateurs_document, nojson: true, type: 'binary'}
    )

    const commandeMaitrecles = messageChiffre.commandeMaitrecles
    commandeMaitrecles.partition = commandeMaitrecles['_partition']
    delete commandeMaitrecles['_partition']

    const dataChiffre = messageChiffre.doc.data_chiffre.slice(1)  // Retirer le premier character multibase (base64)

    // contenu : contenu compresse (gzip) et chiffre en base64
    // commandeMaitrecles : information de dechiffrage pour le maitre des cles
    return { contenu: dataChiffre, commandeMaitrecles }
}

export async function submitHtmlForm(workers, application_id, contenuHtml, token, certifcatsChiffragePem, opts) {
    opts = opts || {}
  
    let urlConnexion = null
    if(opts.urlConnexion) urlConnexion = new URL(opts.urlConnexion)
    else {
        urlConnexion = new URL(window.location.href)
        if(opts.module) urlConnexion.pathname = opts.module
        else urlConnexion.pathname = 'landing'
    }
    urlConnexion.pathname = urlConnexion.pathname + '/public/submit'

    const now = new Date()
    const dateFormattee = now.toUTCString();

    const from = opts.from || 'Landing page'
    const subject = opts.subject || 'Landing Form ' + application_id + ' on ' + dateFormattee
    const optionsMessage = { subject }
    if(opts.fichiers) optionsMessage.files = opts.fichiers

    const headerContenu = `
    <p>--- HEADER ---</p>
    <div class='header'>
      <p>Application Id : ${application_id}</p>
      <p>Date client : ${dateFormattee}</p>
    </div>
    <p>--- FIN HEADER ---</p>
    <p> </p>
    `
    const contenuAvecHeader = headerContenu + contenuHtml
  
    const messageChiffre = await chiffrerMessage(workers, certifcatsChiffragePem, from, contenuAvecHeader, optionsMessage)
    console.debug("Message chiffre : ", messageChiffre)
  
    const reponse = await axios({
      method: 'POST',
      url: urlConnexion.href,
      data: {message: messageChiffre, token},
    })
  
    return reponse.data
}

export async function loadConfiguration() {
    try {
        const location = new URL(window.location.href)
        location.pathname = location.pathname + '/config.json'
        const axiosImport = await import('axios')
        const axios = axiosImport.default
        const reponse = await axios.get(location.href)
        const config = reponse.data || {}
        console.info("Configuration chargee ", config)
        return config
    } catch(err) {
        console.error("Erreur chargement fiche systeme : %O", err)
    }
}

export async function loadFiche(urlFiche) {
    try {
        const axiosImport = await import('axios')
        const axios = axiosImport.default
        const reponse = await axios.get(urlFiche)
        const fiche = reponse.data || {}
        // console.debug("loadFiche ", fiche)
        return fiche
    } catch(err) {
        console.error("Erreur chargement fiche systeme : %O", err)
    }
}

export class ConfigDao {
    constructor(chiffrage) {
      this.chiffrage = chiffrage
  
      this.config = null
      this.fiche = null
      this.contenuFiche = null
      this.location = null
    }
    
    setConfig(config) {
      this.config = config
      this.location = new URL(config.fiche_url)
    }
    
    async reload() {
      if(!this.location) throw new Error('config non initialisee ou invalide')
      const fiche = await loadFiche(this.location.href)
      this.fiche = fiche
      this.contenuFiche = JSON.parse(fiche.contenu)
      return this.fiche
    }
  
    getClesChiffrage() {
      return this.contenuFiche.chiffrage
    }
  
    getConfig() {
      return this.config
    }
  
    getContenuFiche() {
      return this.contenuFiche || {}
    }
  
    getUrlsApplication() {
      let urlLocal = null
      const hostnameLocal = window.location.hostname
      
      const appUrls = this.contenuFiche.applications.landing_web
        .filter(item=>item.nature === 'dns')
        .map(item=>{
          const url = new URL(item.url)
          if(url.hostname === hostnameLocal) urlLocal = url  // Conserver lien vers hostname courant
          return url
        })
  
      // Retourner url de l'application courante de preference
      if(urlLocal) return [urlLocal]
  
      return appUrls
    }
  
    clear() {
      this.fiche = null
      this.contenuFiche = null
    }
}

export async function preparerFichiersBatch(uploads) {
  console.debug("preparerFichiersBatch Uploads %s", uploads)
  // const uploads = await chargerUploads(batchId)
  if(uploads.length === 0) return null

  const nowEpoch = Math.floor(new Date().getTime() / 1000)

  const mapping = []
  for await (let item of uploads) {
    console.debug("preparerFichiersBatch Mapper ", item)
    try {
      const transaction = item.transactionGrosfichiers
      const mimetype = transaction.mimetype,
            fuuid = transaction.fuuid,
            cle = item.cle

      const fichier = {
        name: item.nom,
        date: nowEpoch,
        size: item.taille,
        digest: fuuid,
        file: fuuid,
        encrypted_size: item.taille_chiffree,
        mimetype,
        decryption: {
          key: cle.cleSecrete,
          header: cle.header, 
          format: cle.format,
        }
      }
      mapping.push(fichier)
    } catch(err) {
      console.warn("Erreur preparation fichier %O, skip : %O", item, err)
    }
  }

  return mapping
}
