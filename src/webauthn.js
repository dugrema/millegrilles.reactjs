import multibase from 'multibase'
import base64url from 'base64url'

export async function repondreRegistrationChallenge(nomUsager, challengeWebauthn, opts) {
  opts = opts || {}
  const DEBUG = opts.DEBUG

  if(DEBUG) console.debug('repondreRegistrationChallenge nomUsager: %s, attestation: %O', nomUsager, challengeWebauthn)
  // Parse options, remplacer base64 par buffer
  const challenge = Buffer.from(challengeWebauthn.challenge, 'base64')  // multibase.decode(publicKey.challenge)
  const attestation = challengeWebauthn.attestation
  const userId = Buffer.from(challengeWebauthn.user.id, 'base64')  // multibase.decode(publicKey.user.id)

  const publicKey = {
    ...challengeWebauthn,
    challenge,
    user: {
      ...challengeWebauthn.user,
      id: userId,
      name: nomUsager,
      displayName: nomUsager,
    }
  }

  // Cle publique
  if(DEBUG) console.debug("Registration options avec buffers : %O", publicKey)
  const newCredential = await navigator.credentials.create({publicKey})
  if(DEBUG) console.debug("New credential : %O", newCredential)

  // Transmettre reponse
  const credentialResponse = newCredential.response
  const jsonData = base64url.encode(credentialResponse.clientDataJSON)
  const attestationObject = base64url.encode(new Uint8Array(credentialResponse.attestationObject))
  const data = {
    id: newCredential.id,
    response: {
      attestationObject,
      clientDataJSON: jsonData,
    },
    type: newCredential.type,
  }

  return data
}
