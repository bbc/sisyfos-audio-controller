import { store, state } from './reducers/store'
import {
    mixerProtocolList,
    mixerProtocolPresets,
    mixerGenericConnection,
    remoteConnections,
} from './mainClasses'
import { SnapshotHandler } from './utils/SnapshotHandler'
import { socketServer } from './expressHandler'

import { storeUpdateSettings } from 'shared/src/actions/settingsActions'
import * as IO from 'shared/src/constants/SOCKET_IO_DISPATCHERS'
import * as FADER_ACTIONS from 'shared/src/actions/faderActions'

import {
    loadSettings,
    saveSettings,
    getSnapShotList,
    getCcgSettingsList,
    setCcgDefault,
    getMixerPresetList,
    getCustomPages,
    saveCustomPages,
} from './utils/SettingsStorage'

import {
    storeFlushChLabels,
    storeSetAssignedFader,
    storeSetAuxLevel,
} from 'shared/src/actions/channelActions'
import { logger } from './utils/logger'
import { ICustomPages } from 'shared/src/reducers/settingsReducer'
import { fxParamsList } from 'shared/src/constants/MixerProtocolInterface'
import path from 'path'
import { IChannel } from 'shared/src/reducers/channelsReducer'

export class MainThreadHandlers {
    snapshotHandler: SnapshotHandler

    constructor() {
        logger.info('Setting up MainThreadHandlers')

        this.snapshotHandler = new SnapshotHandler()
        store.dispatch(storeUpdateSettings(loadSettings(state)))
    }

    updateFullClientStore() {
        this.recalcAssignedChannels()
        socketServer.emit(IO.SOCKET_SET_FULL_STORE, state)
    }

    updatePartialStore(faderIndex: number) {
        socketServer.emit(IO.SOCKET_SET_STORE_FADER, {
            faderIndex: faderIndex,
            state: state.faders[0].fader[faderIndex],
        })
        state.channels[0].chMixerConnection.forEach((chMixerConnection) => {
            chMixerConnection.channel.forEach(
                (channel: IChannel, index: number) => {
                    if (channel.assignedFader === faderIndex) {
                        socketServer.emit(IO.SOCKET_SET_STORE_CHANNEL, {
                            channelIndex: index,
                            state: channel,
                        })
                    }
                }
            )
        })
    }

    updateMixerOnline(mixerIndex: number, onLineState?: boolean) {
        socketServer.emit(IO.SOCKET_SET_MIXER_ONLINE, {
            mixerIndex,
            mixerOnline:
                onLineState ?? state.settings[0].mixers[mixerIndex].mixerOnline,
        })
    }

    // Assigned channel to faders are right now based on Channel.assignedFader
    // Plan is to change it so fader.assignedChannel will be the master (a lot of change in code is needed)
    recalcAssignedChannels() {
        store.dispatch(FADER_ACTIONS.removeAllAssignedChannels())
        state.channels[0].chMixerConnection.forEach((mixer, mixerIndex) => {
            mixer.channel.forEach((channel: IChannel, channelIndex) => {
                if (
                    channel.assignedFader >= 0 &&
                    state.faders[0].fader[channel.assignedFader]
                ) {
                    store.dispatch(
                        FADER_ACTIONS.storeSetAssignedChannel(
                            channel.assignedFader,
                            mixerIndex,
                            channelIndex,
                            true
                        )
                    )
                }
            })
        })
    }

    socketServerHandlers(socket: any) {
        logger.info('Setting up socket IO main handlers.')

        // get-store get-settings and get-mixerprotocol will be replaces with
        // serverside Redux middleware emitter when moved to Socket IO:
        socket
            .on('get-store', () => {
                logger.info(`Setting initial store on: ${socket.client.id}`)
                this.updateFullClientStore()
            })
            .on('get-settings', () => {
                socketServer.emit('set-settings', state.settings[0])
            })
            .on('get-mixerprotocol', () => {
                socketServer.emit('set-mixerprotocol', {
                    mixerProtocol:
                        mixerProtocolPresets[
                            state.settings[0].mixers[0].mixerProtocol
                        ],
                    mixerProtocolPresets: mixerProtocolPresets,
                    mixerProtocolList: mixerProtocolList,
                })
            })
            .on(IO.SOCKET_GET_SNAPSHOT_LIST, () => {
                logger.info('Get snapshot list')
                socketServer.emit(
                    IO.SOCKET_RETURN_SNAPSHOT_LIST,
                    getSnapShotList()
                )
            })
            .on(IO.SOCKET_LOAD_SNAPSHOT, (payload: string) => {
                logger.info('Load Snapshot')
                this.snapshotHandler.loadSnapshotSettings(
                    path.resolve('storage', payload),
                    true
                )
                this.updateFullClientStore()
            })
            .on(IO.SOCKET_SAVE_SNAPSHOT, (payload: string) => {
                logger.info('Save Snapshot')
                this.snapshotHandler.saveSnapshotSettings(
                    path.resolve('storage', payload)
                )

                socketServer.emit(
                    IO.SOCKET_RETURN_SNAPSHOT_LIST,
                    getSnapShotList()
                )
            })
            .on(IO.SOCKET_GET_CCG_LIST, () => {
                logger.info('Get CCG settings list')
                socketServer.emit(
                    IO.SOCKET_RETURN_CCG_LIST,
                    getCcgSettingsList()
                )
            })
            .on(IO.SOCKET_GET_MIXER_PRESET_LIST, () => {
                logger.info('Get Preset list')
                socketServer.emit(
                    IO.SOCKET_RETURN_MIXER_PRESET_LIST,
                    getMixerPresetList(
                        mixerGenericConnection.getPresetFileExtention()
                    )
                )
            })
            .on(IO.SOCKET_SAVE_CCG_FILE, (payload: any) => {
                logger.info(`Set default CCG File: ${payload}`)
                setCcgDefault(payload)
                this.updateFullClientStore()
            })
            .on(IO.SOCKET_LOAD_MIXER_PRESET, (payload: any) => {
                logger.info(`Set Mixer Preset: ${payload}`)
                mixerGenericConnection.loadMixerPreset(payload)
                this.updateFullClientStore()
            })
            .on(IO.SOCKET_GET_PAGES_LIST, () => {
                logger.info('Get custom pages list')
                let customPages: ICustomPages[] = getCustomPages()
                if (
                    customPages.length === state.settings[0].numberOfCustomPages
                ) {
                    socketServer.emit(IO.SOCKET_RETURN_PAGES_LIST, customPages)
                } else {
                    for (
                        let i = 0;
                        i < state.settings[0].numberOfCustomPages;
                        i++
                    ) {
                        if (!customPages[i]) {
                            customPages.push({
                                id: 'custom' + String(i),
                                label: 'Custom ' + String(i),
                                faders: [],
                            })
                        }
                    }
                    socketServer.emit(
                        IO.SOCKET_RETURN_PAGES_LIST,
                        customPages.slice(
                            0,
                            state.settings[0].numberOfCustomPages
                        )
                    )
                }
            })
            .on(IO.SOCKET_SET_PAGES_LIST, (payload: any) => {
                saveCustomPages(payload)
                logger.info(`Save custom pages list: ${payload}`)
            })
            .on(IO.SOCKET_SAVE_SETTINGS, (payload: any) => {
                logger.data(payload).info('Save settings:')
                saveSettings(payload)
                this.updateFullClientStore()
                /** Delay restart to ensure the async saveSettings is done before restarting*/
                setTimeout(() => {
                    process.exit(0)
                }, 1000)
            })
            .on(IO.SOCKET_RESTART_SERVER, () => {
                process.exit(0)
            })
            .on(IO.SOCKET_SET_ASSIGNED_FADER, (payload: any) => {
                logger.trace(
                    `Set assigned fader.\n  Mixer: ${
                        payload.mixerIndex + 1
                    }\n  Channel: ${payload.channel}\n  Fader: ${
                        payload.faderAssign
                    }`
                )
                store.dispatch(
                    storeSetAssignedFader(
                        payload.mixerIndex,
                        payload.channel,
                        payload.faderAssign
                    )
                )

                this.updateFullClientStore()
            })
            .on(IO.SOCKET_SET_FADER_MONITOR, (payload: any) => {
                store.dispatch(
                    FADER_ACTIONS.storeFaderMonitor(
                        payload.faderIndex,
                        payload.auxIndex
                    )
                )
                this.updateFullClientStore()
            })
            .on(IO.SOCKET_SHOW_IN_MINI_MONITOR, (payload: any) => {
                store.dispatch(
                    FADER_ACTIONS.storeShowInMiniMonitor(
                        payload.faderIndex,
                        payload.showInMiniMonitor
                    )
                )
                this.updateFullClientStore()
            })
            .on(IO.SOCKET_SET_INPUT_OPTION, (payload: any) => {
                mixerGenericConnection.updateChannelSettings(
                    payload.channel,
                    payload.prop,
                    payload.option
                )
            })
            .on(IO.SOCKET_SET_AUX_LEVEL, (payload: any) => {
                logger.trace(
                    `Set Auxlevel Channel: ${payload.channel} Auxindex : ${payload.auxIndex} level : ${payload.level}`
                )
                store.dispatch(
                    storeSetAuxLevel(
                        0,
                        payload.channel,
                        payload.auxIndex,
                        payload.level
                    )
                )
                mixerGenericConnection.updateAuxLevel(
                    payload.channel,
                    payload.auxIndex
                )
                this.updateFullClientStore()
                remoteConnections.updateRemoteAuxPanels()
            })
            .on(IO.SOCKET_SET_FX, (payload: any) => {
                logger.trace(
                    `Set ${fxParamsList[payload.fxParam]}: ${payload.channel}`
                )
                store.dispatch(
                    FADER_ACTIONS.storeFaderFx(
                        payload.fxParam,
                        payload.channel,
                        payload.level
                    )
                )
                mixerGenericConnection.updateFx(
                    payload.fxParam,
                    payload.channel
                )
                this.updatePartialStore(payload.channel)
            })
            .on(IO.SOCKET_NEXT_MIX, () => {
                store.dispatch(FADER_ACTIONS.storeNextMix())
                mixerGenericConnection.updateOutLevels()
                this.updateFullClientStore()
            })
            .on(IO.SOCKET_CLEAR_PST, () => {
                store.dispatch(FADER_ACTIONS.storeClearPst())
                mixerGenericConnection.updateOutLevels()
                this.updateFullClientStore()
            })
            .on(IO.SOCKET_TOGGLE_PGM, (faderIndex: any) => {
                mixerGenericConnection.checkForAutoResetThreshold(faderIndex)
                store.dispatch(FADER_ACTIONS.storeTogglePgm(faderIndex))
                mixerGenericConnection.updateOutLevel(faderIndex)
                this.updatePartialStore(faderIndex)
            })
            .on(IO.SOCKET_TOGGLE_VO, (faderIndex: any) => {
                mixerGenericConnection.checkForAutoResetThreshold(faderIndex)
                store.dispatch(FADER_ACTIONS.storeToggleVo(faderIndex))
                mixerGenericConnection.updateOutLevel(faderIndex)
                this.updatePartialStore(faderIndex)
            })
            .on(IO.SOCKET_TOGGLE_SLOW_FADE, (faderIndex: any) => {
                store.dispatch(FADER_ACTIONS.storeToggleSlowFade(faderIndex))
                this.updatePartialStore(faderIndex)
            })
            .on(IO.SOCKET_TOGGLE_PST, (faderIndex: any) => {
                store.dispatch(FADER_ACTIONS.storeTogglePst(faderIndex))
                mixerGenericConnection.updateNextAux(faderIndex)
                this.updatePartialStore(faderIndex)
            })
            .on(IO.SOCKET_TOGGLE_PFL, (faderIndex: any) => {
                store.dispatch(FADER_ACTIONS.storeTogglePfl(faderIndex))
                mixerGenericConnection.updatePflState(faderIndex)
                this.updatePartialStore(faderIndex)
            })
            .on(IO.SOCKET_TOGGLE_MUTE, (faderIndex: any) => {
                store.dispatch(FADER_ACTIONS.storeToggleMute(faderIndex))
                mixerGenericConnection.updateMuteState(faderIndex)
                this.updatePartialStore(faderIndex)
            })
            .on(IO.SOCKET_TOGGLE_AMIX, (faderIndex: any) => {
                store.dispatch(FADER_ACTIONS.storeToggleAMix(faderIndex))
                mixerGenericConnection.updateAMixState(faderIndex)
                this.updatePartialStore(faderIndex)
            })
            .on(IO.SOCKET_TOGGLE_IGNORE, (faderIndex: any) => {
                store.dispatch(
                    FADER_ACTIONS.storeToggleIgnoreAutomation(faderIndex)
                )
                this.updatePartialStore(faderIndex)
            })
            .on(IO.SOCKET_SET_FADERLEVEL, (payload: any) => {
                logger.trace(
                    `Set fader level\n  Channel: ${
                        payload.faderIndex + 1
                    }\n  Level: ${payload.level}`
                )
                store.dispatch(
                    FADER_ACTIONS.storeFaderLevel(
                        payload.faderIndex,
                        parseFloat(payload.level)
                    )
                )
                mixerGenericConnection.updateOutLevel(payload.faderIndex, 0)
                mixerGenericConnection.updateNextAux(payload.faderIndex)
                this.updatePartialStore(payload.faderIndex)
            })
            .on(IO.SOCKET_SET_INPUT_GAIN, (payload: any) => {
                logger.trace(
                    `Set fInput\n  Gain Channel: ${
                        payload.faderIndex + 1
                    }\n  Level: ${payload.level}`
                )
                store.dispatch(
                    FADER_ACTIONS.storeInputGain(
                        payload.faderIndex,
                        parseFloat(payload.level)
                    )
                )
                mixerGenericConnection.updateInputGain(payload.faderIndex)
                this.updatePartialStore(payload.faderIndex)
            })
            .on(IO.SOCKET_SET_INPUT_SELECTOR, (payload: any) => {
                logger.trace(
                    `Set Input selector: ${
                        payload.faderIndex + 1
                    }\n  Selected: ${payload.selected}`
                )
                logger.debug(payload)
                store.dispatch(
                    FADER_ACTIONS.storeInputSelector(
                        payload.faderIndex,
                        parseFloat(payload.selected)
                    )
                )
                mixerGenericConnection.updateInputSelector(payload.faderIndex)
                this.updatePartialStore(payload.faderIndex)
            })
            .on(IO.SOCKET_TOGGLE_ALL_MANUAL, () => {
                logger.trace('Toggle manual mode for all')
                store.dispatch(FADER_ACTIONS.storeAllManual())
                this.updateFullClientStore()
            })
            .on(IO.SOCKET_SET_LABELS, (payload: any) => {
                store.dispatch(FADER_ACTIONS.updateLabels(payload.update))
            })
            .on(IO.SOCKET_GET_LABELS, () => {
                socketServer.emit(
                    IO.SOCKET_GET_LABELS,
                    state.faders[0].fader.map((f) => f.userLabel)
                )
            })
            .on(IO.SOCKET_FLUSH_LABELS, () => {
                store.dispatch(FADER_ACTIONS.flushExtLabels())
                store.dispatch(storeFlushChLabels())
            })
    }
}
