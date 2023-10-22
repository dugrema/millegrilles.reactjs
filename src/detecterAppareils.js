import { useState, useEffect } from 'react'

const FULLSCREEN_ENABLED = document.fullscreenEnabled

export async function detecterSupport() {
  const webp = await supporteFormatWebp()
  const webm = supporteFormatWebm()
  const fileStream = await supporteFileStream()
  const touch = isTouchEnabled()

  const support = {webp, webm, fileStream, touch, fullscreen: FULLSCREEN_ENABLED}
  
  // console.info("Support du navigateur : %O", support)
  return support
}

export function useDetecterSupport() {
  const [support, setSupport] = useState('')
  
  useEffect(()=>{
      detecterSupport()
          .then(support=>setSupport(support))
          .catch(err=>console.error("Erreur detection support media ", err))
  }, [setSupport])
  
  return support
}

// Detection d'appareils media (camera, son, etc)
export async function detecterAppareilsDisponibles() {
  return navigator.mediaDevices.enumerateDevices().then(gotDevices)
}

// Capacites connues : audioinput, audiooutput, videoinput
function gotDevices(deviceInfos) {

  const appareils = {}

  for (var i = 0; i !== deviceInfos.length; ++i) {
    var deviceInfo = deviceInfos[i];
    appareils[deviceInfo.kind] = true
  }

  return Object.keys(appareils)
}

export async function supporteCamera() {
  const appareils = await detecterAppareilsDisponibles()
  return appareils.includes('videoinput')
}

/* https://stackoverflow.com/questions/5573096/detecting-webp-support */
export async function supporteFormatWebp() {
  const resultat = await check_webp_feature('lossy')
  // console.debug("Resultat : %O", resultat)
  return resultat.result
}

// check_webp_feature:
//   'feature' can be one of 'lossy', 'lossless', 'alpha' or 'animation'.
//   'callback(feature, isSupported)' will be passed back the detection result (in an asynchronous way!)
function check_webp_feature(feature) {
  var kTestImages = {
      lossy: "UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA",
      lossless: "UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==",
      alpha: "UklGRkoAAABXRUJQVlA4WAoAAAAQAAAAAAAAAAAAQUxQSAwAAAARBxAR/Q9ERP8DAABWUDggGAAAABQBAJ0BKgEAAQAAAP4AAA3AAP7mtQAAAA==",
      animation: "UklGRlIAAABXRUJQVlA4WAoAAAASAAAAAAAAAAAAQU5JTQYAAAD/////AABBTk1GJgAAAAAAAAAAAAAAAAAAAGQAAABWUDhMDQAAAC8AAAAQBxAREYiI/gcA"
  };
  var img = new Image();
  const result = new Promise(resolve=>{
    img.onload = function () {
      var result = (img.width > 0) && (img.height > 0);
      resolve({feature, result});
    };
    img.onerror = function () {
      resolve({feature, result: false});
    };
  })
  img.src = "data:image/webp;base64," + kTestImages[feature];

  return result
}

export function supporteFormatWebm() {
  const video = document.createElement('video');

  // "probably"
  const canPlayType = video.canPlayType('video/webm; codecs="vp9, vorbis"')

  return canPlayType==='probably'?true:false
}

// Source : https://davidwalsh.name/detect-supported-video-formats-javascript
const VIDEO_FORMATS = {
  // ogg: 'video/ogg; codecs="theora"',
  h264: 'video/mp4; codecs="avc1.42E01E"',
  webm: 'video/webm; codecs="vp8, vorbis"',
  vp9: 'video/webm; codecs="vp9"',
  // hls: 'application/x-mpegURL; codecs="avc1.42E01E"',
  // hevc: 'video/mp4; codecs="hevc"',
  hvc1: 'video/mp4; codecs="hvc1"'
}

export function detecterFormatsVideos() {
  const video = document.createElement('video');
  const formatsSupportes = Object.keys(VIDEO_FORMATS).reduce((acc, type)=>{
    const supporte = video.canPlayType(VIDEO_FORMATS[type])
    acc[type] = supporte==='probably'?true:false
    return acc
  }, {})

  // Mapper codec hevc (tel que reconnu sur ios)
  formatsSupportes.hevc = formatsSupportes.hvc1

  return formatsSupportes
}

export function supporteFileStream() {
  /* Detecte si file.stream() et blob.stream() fonctionnent */
  const blobStream = Blob.prototype.stream?true:false
  const fileStream = File.prototype.stream?true:false
  const readableStream = ReadableStream.prototype?true:false
  const reader = ReadableStream.prototype.getReader?true:false
  // console.debug(
  //   "Blob.prototype.stream : %s, File.prototype.stream %s, ReadableStream: %s, ReadableStream.getReader : %s",
  //   blobStream, fileStream, readableStream, reader)

  // Hack pour Safari, stream n'est pas stable pour fichiers 1MB+
  var isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)

  return !isSafari && blobStream && fileStream && readableStream && reader
}

// https://www.geeksforgeeks.org/how-to-detect-touch-screen-device-using-javascript/
export function isTouchEnabled() {
	return ( 'ontouchstart' in window ) ||
		( navigator.maxTouchPoints > 0 ) ||
		( navigator.msMaxTouchPoints > 0 );
}
