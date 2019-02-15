import React, { PureComponent } from 'react';
import { connect } from "react-redux";

import VuMeter from './VuMeter';
//assets:
import '../assets/css/Channel.css';
import { MixerProtocolPresets } from '../utils/MixerProtocolPresets';

class Channel extends PureComponent {
    constructor(props) {
        super(props);
        this.channelIndex = this.props.channelIndex;
        this.mixerConnection = this.props.mixerConnection;
        this.state = {
        };
        this.mixerProtocol = MixerProtocolPresets[this.props.store.settings[0].mixerProtocol];

        this.pgmButton = this.pgmButton.bind(this);
        this.pstButton = this.pstButton.bind(this);
        this.snapButton = this.snapButton.bind(this);
        this.renderLabel = this.renderLabel.bind(this);
    }

    handlePgm() {
        this.props.dispatch({
            type:'SET_PGM',
            channel: this.channelIndex
        });
        this.mixerConnection.updateOscLevel(this.channelIndex);
    }

    handlePst() {
        this.props.dispatch({
            type:'SET_PST',
            channel: this.channelIndex
        });
    }

    handleLevel(event) {
        this.props.dispatch({
            type:'SET_FADER_LEVEL',
            channel: this.channelIndex,
            level: event.target.value
        });
        this.mixerConnection.updateOscLevel(this.channelIndex);
    }


    handleSnap(snapIndex) {
        this.props.dispatch({
            type:'SET_SNAP',
            channel: this.channelIndex,
            snapIndex: snapIndex
        });
    }

    fader() {
        return (
            <input className="channel-volume-slider"
                style= {
                    Object.assign(
                        this.props.store.settings[0].showSnaps
                        ?   {
                                width: "220px",
                                marginTop: "140px",
                                transform: "translate(-40px, 0) rotate(270deg) "
                            }
                        :   {
                                width: "460px",
                                marginTop: "260px",
                                transform: "translate(-160px, 0) rotate(270deg) "
                            }
                    )
                }
                id="typeinp"
                type="range"
                min={this.mixerProtocol.fader.min}
                max={this.mixerProtocol.fader.max}
                step={this.mixerProtocol.fader.step}
                value= {this.props.store.channels[0].channel[this.channelIndex].faderLevel}
                onChange={event => {
                    event.preventDefault();
                    this.handleLevel(event);
                }}
            />
        )
    }

    pgmButton() {
        return (
            <button
                className="channel-pgm-button"
                style={
                    Object.assign(
                        this.props.store.channels[0].channel[this.channelIndex].pgmOn
                        ? {backgroundColor: "red"}
                        : {backgroundColor: "rgb(66, 27, 27)"},
                        this.props.store.settings[0].showSnaps
                        ?   {
                                height: "40px",
                                marginTop: "130px"
                            }
                        :   {
                                height: "90px",
                                marginTop: "260px"
                            }
                    )
                }
                onClick={event => {
                    this.handlePgm(event);
                }}
            >PGM</button>
        )
    }

    pstButton() {
        return (
            <button
                className="channel-pst-button"
                style={
                    Object.assign(
                        this.props.store.channels[0].channel[this.channelIndex].pstOn
                        ? {backgroundColor: "green"}
                        : {backgroundColor: "rgb(59, 73, 59)"},
                        this.props.store.settings[0].showSnaps
                        ?   {height: "40px"}
                        :   {height: "90px"}
                    )
                }
                onClick={event => {
                    this.handlePst(event);
                }}
            >PST</button>
        )
    }

    snapButton(snapIndex) {
        if (this.props.store.settings[0].showSnaps) {
            return (
                <div key={snapIndex} className="channel-snap-line">
                    <button
                        className="channel-snap-button"
                        style={this.props.store.channels[0].channel[this.channelIndex].snapOn[snapIndex]
                            ? {backgroundColor: "rgb(183, 182, 20)"}
                            : {backgroundColor: "rgb(89, 83, 10)"}
                        }
                        onClick={event => {
                            this.handleSnap(snapIndex);
                        }}
                    >{snapIndex + 1 }</button>
                    <br/>
                </div>
            )
        } else {
            return("")
        }
    }

    renderLabel() {
        if (this.props.store.channels[0].channel[this.channelIndex].label === "") {
            return (
                <div className="channel-name">
            CH {this.channelIndex + 1}
        </div>
            )
        }
        return (
        <div className="channel-name">
            {this.props.store.channels[0].channel[this.channelIndex].label}
        </div>
        )
    }

    render() {
        return (
        <div className="channel-body">
            {this.fader()}
            <VuMeter channelIndex = {this.channelIndex}/>
            <br/>
            {this.pgmButton()}
            <br/>
            {this.pstButton()}
            <br/>
            {this.renderLabel()}
            <div className="channel-gain-label">
                GAIN: {parseInt(this.props.store.channels[0].channel[this.channelIndex].outputLevel*100)/100}
            </div>
            <div className="channel-snap-body">
                {this.props.store.channels[0].channel[this.channelIndex].snapOn
                    .map((none, index) => {
                        return this.snapButton(index)
                    })
                }
            </div>
        </div>
        )
    }
}

const mapStateToProps = (state) => {
    return {
        store: state
    }
}

export default connect(mapStateToProps)(Channel);
