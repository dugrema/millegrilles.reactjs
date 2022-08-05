import React from 'react'
import moment from 'moment-timezone'
import momentDurationFormatSetup from "moment-duration-format"
momentDurationFormatSetup(moment)  // Activer plugin

const CONST_KB = 1024,
      CONST_MB = CONST_KB*1024,
      CONST_GB = CONST_MB*1024,
      CONST_TB = CONST_GB*1024,
      CONST_PB = CONST_TB*1024

const CONST_DATE_DEFAULT = 'YYYY/MM/DD',
      CONST_DATETIME_DEFAULT = 'YYYY/MM/DD HH:mm:ss',
      CONST_DATEMONTHHOUR_DEFAULT = 'MMM-DD HH:mm:ss',
      CONST_TIMEZONE_DEFAULT  = 'America/Toronto'

export function FormatteurTaille(props) {
    const value = props.value
    const precision = props.precision || 3
  
    if(!value) return ''

    let valueCalculated, unit;
    if(value > CONST_PB) {
        valueCalculated = (value/CONST_PB)
        unit = 'Pb'
    } else if(value > CONST_TB) {
        valueCalculated = (value/CONST_TB)
        unit = 'Tb'
    } else if(value > CONST_GB) {
        valueCalculated = (value/CONST_GB)
        unit = 'Gb'
    } else if(value > CONST_MB) {
        valueCalculated = (value/CONST_MB)
        unit = 'Mb'
    } else if(value > CONST_KB) {
        valueCalculated = (value/CONST_KB)
        unit = 'kb'
    } else {
        result = value
        unit = 'bytes'
    }

    let result = null
    if(valueCalculated >= 1000) result = Math.floor(valueCalculated)
    else result = valueCalculated.toPrecision(precision)
    const label = result + ' ' + unit

    return <span>{label}</span>
}

export function FormatterDate(props) {
    const format = props.format || CONST_DATETIME_DEFAULT,
          timezone = props.timezone || CONST_TIMEZONE_DEFAULT

    const value = props.value

    if(!value) return ''

    return moment(value*1000).tz(timezone).format(format)
}

export function FormatterDuree(props) {
    const { value } = props
    if(!value) return ''
    const momentDuree = moment.duration(value, 'seconds')
    // console.debug("Moment duree : %O", momentDuree)

    if(value < 60.0) {
        return Math.floor(value) + ' secs'
    }

    return momentDuree.format('h:mm:ss')
}
