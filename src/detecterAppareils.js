// Detection d'appareils media (camera, son, etc)
export async function detecterAppareilsDisponibles() {
  return navigator.mediaDevices.enumerateDevices().then(gotDevices)
}

// Capacites connues : audioinput, audiooutput, videoinput
function gotDevices(deviceInfos) {

  const appareils = {}

  for (var i = 0; i !== deviceInfos.length; ++i) {
    var deviceInfo = deviceInfos[i];
    var option = document.createElement('option');
    option.value = deviceInfo.deviceId;
    appareils[deviceInfo.kind] = true
  }

  return appareils
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
  // console.debug("!!! supportFormatWebm %O", canPlayType)

  return canPlayType?true:false
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
