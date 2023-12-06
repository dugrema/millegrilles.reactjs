import { openDB } from 'idb'

const DATABASES = {
    'millegrilles': {tables: ['clesDechiffrees']},
    'collections': {tables: ['fichiers', 'downloadsFichiers', 'downloads', 'uploadsFichiers', 'uploads']},
    'documents': {tables: ['documents', 'groupes', 'categories']}
}

/** 
 * Supprime le contenu des tables dans IDB 
 * Utiliser lors d'une deconnexion.
*/
export async function supprimerContenuIdb(opts) {
    opts = opts || {}
    const nomUsager = opts.nomUsager

    for await (const dbName of Object.keys(DATABASES)) {
        try {
            const db = await openDB(dbName)
            const params = DATABASES[dbName]
            const tables = params.tables

            for await (const tableName of tables) {
                try {
                    const store = db.transaction(tableName, 'readwrite').store
                    await store.clear()
                } catch(err) {
                    console.debug("supprimerContenuIdb Erreur clearing IDB %s table : %s", dbName, tableName, ''+err)
                }
            }
        } catch(err) {
            console.warn("supprimerContenuIdb Erreur traitement IDB %s : %O", dbName, err)
        }
    }

    if(nomUsager) {
        console.info("Retirer information de certificat de l'usager ", nomUsager)
        // Supprimer information secrete de l'usager
        try {
            const db = await openDB('millegrilles')
            const store = db.transaction('usagers', 'readwrite').store
            const usagerDb = await store.get(nomUsager)
            if(usagerDb) {
                // Supprimer le certificat de l'usager
                delete usagerDb.clePriveePem
                delete usagerDb.certificat
                delete usagerDb.fingerprintPk
            }
            await store.put(usagerDb)
        } catch(err) {
            console.warn("supprimerContenuIdb Erreur suppression certificat usager %s : %O", nomUsager, err)
        }
    }

}
