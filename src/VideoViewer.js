import React, {useEffect, useState, useMemo, useCallback, useRef} from 'react'
// import ReactPlayer from 'react-player/file'

function VideoViewer(props) {
    const {
        poster,
        srcVideo,
        className,
        timeStamp,
        jumpToTimeStamp,

        // Evenements
        onTimeUpdate, onProgress, onPlay, onError, onWaiting, onCanPlay, onAbort, onEmptied,
    } = props

    const width = props.width || '100%',
          height = props.height || '100%'  //,
          // codecVideo = props.codecVideo || '',
          // mimetype = props.mimetype || ''
          
    const [timeStampEffectif, setTimeStampEffectif] = useState(0)
    const [actif, setActif] = useState(true)
    const [playbackCommence, setPlaybackCommence] = useState(false)

    const refVideo = useRef()

    let sources = useMemo(()=>{
        if(!srcVideo) return []

        // console.debug("srcVideo ", srcVideo)

        const mimetype = srcVideo.mimetype
        let mimetypeCodec = mimetype
        if(srcVideo.codec) {
            mimetypeCodec = mapperCodec(mimetype, srcVideo.codec)
        }

        let srcHref = srcVideo.src
        if(timeStampEffectif) {
            srcHref = srcHref + '#t=' + timeStampEffectif
            setPlaybackCommence(true)
        }
        return [<source key={mimetypeCodec} src={srcHref} type={mimetypeCodec} />]

        // let mimetypeCodec = mimetype
        // if(codecVideo) {
        //     mimetypeCodec = mimetype + `;codecs="${codecVideo}"`
        // }
    
        // const sources = videos.map(item=>{
        //     const {src, mimetype, codecVideo} = item
        //     let mimetypeCodec = mapperCodec(mimetype, codecVideo)
        //     let srcHref = src

        //     if(timeStampEffectif) {
        //         srcHref = srcHref + '#t=' + timeStampEffectif
        //         // console.debug("Href video avec ts : %s", srcHref)
        //         setPlaybackCommence(true)
        //     }

        //     return <source key={src} src={srcHref} type={mimetypeCodec} />
        // })

        // if(src) {
        //     let mimetypeCodec = mapperCodec(mimetype, codecVideo)
        //     sources.push(<source key="base" src={src} type={mimetypeCodec} />)
        // }

        // return sources
    }, [/*src, videos, codecVideo, mimetype, */ srcVideo, timeStampEffectif, setPlaybackCommence])

    const playbackCommenceHandler = useCallback(event=>{
        setPlaybackCommence(true)
        if(onPlay) onPlay(event)  // propagation
    }, [onPlay, setPlaybackCommence])

    useEffect(()=>{
        // Override pour playback, la source a change
        setPlaybackCommence(false)
        setActif(false)
        setTimeStampEffectif(0)
    }, [/*selecteur, */ srcVideo, setActif, setPlaybackCommence])

    useEffect(()=>{
        if(playbackCommence) return  // Ignorer changements au video si le playback est commence

        // Forcer un toggle d'affichage sur changements sources ou videos
        // console.debug("Changement videos : src : %O, videos : %O", src, videos)
        setActif(false)
        setTimeStampEffectif(timeStamp)
    }, [/* src, videos, sources, */ timeStamp, playbackCommence, setActif])

    useEffect(()=>{
        if(jumpToTimeStamp === -1) return
        if(refVideo.current && refVideo.current.currentTime !== undefined) {
            refVideo.current.currentTime = jumpToTimeStamp
        }
    }, [jumpToTimeStamp, refVideo])

    useEffect(()=>{
        if(!actif) setActif(true)
    }, [actif, setActif])

    if(!actif) return ''

    return (
        <video ref={refVideo} width={width} height={height} className={className} poster={poster} controls
            onPlay={playbackCommenceHandler}
            onTimeUpdate={onTimeUpdate}
            onProgress={onProgress}
            onWaiting={onWaiting}
            onError={onError}
            onCanPlay={onCanPlay}
            onAbort={onAbort}
            onEmptied={onEmptied}>
            {sources}
        </video>
    )
}

export default VideoViewer

function mapperCodec(mimetype, codecVideo) {
    let mimetypeCodec = mimetype
    if(codecVideo === 'hevc') {
        // Nom codec pour iOS
        mimetypeCodec = mimetype + `; codecs="hvc1"`
    } else if(codecVideo === 'h264') {
        // Omettre le codecs, devrait etre supporte partout
        mimetypeCodec = mimetype
    } else if(codecVideo) {
        mimetypeCodec = mimetype + `; codecs="${codecVideo}"`
    } 
    return mimetypeCodec
}