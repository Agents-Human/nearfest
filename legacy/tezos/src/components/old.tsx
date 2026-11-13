/// OLD
import React, { useState } from "react";
import machine from "../assets/machine.svg";
import Modal from "./Modal";
import audio from "../assets/1.mp3";
/* ts-ignore */
interface IProps {
  core: any;
}

interface IState {
  initialloader: boolean;
  loading: boolean;
  nfts: number;
  audio: HTMLAudioElement;
  modal: string | void;
  loadInterval: boolean;
  core: any;
  synced: boolean;
}

export default class VendingMachine extends React.Component<IProps, IState> {
  constructor(props: IProps) {
    super(props);
    this.state = {
      initialloader: true,
      loading: false,
      loadInterval: false,
      nfts: 0,
      audio: new Audio(audio),
      modal: "",
      core: props.core,
      synced: false,
    };
    this.loadState = this.loadState.bind(this);
    this.showModal = this.showModal.bind(this);
    this.playAudio = this.playAudio.bind(this);
  }
  async componentDidMount() {
    // Set Theme
    const theme: string | null = localStorage.getItem("theme")
      ? localStorage.getItem("theme")
      : "light-theme";
    document.body.removeAttribute("class");
    document.body.classList.add(theme!);
    this.setState({ initialloader: false });

    this.updateNFTCount();

    this.state.core.set_machine(0);
    this.state.core.set_sync_setter((x:any) => this.setState({ synced: x }));
  }
  showModal = (val:any) => {
    this.setState({ modal: val });
    this.loadState(false);
  };
  playAudio = () => {
    const playlist = [1, 2, 3];
    const random = Math.floor(Math.random() * playlist.length);
    const song = require(`../assets/${playlist[random]}.mp3`).default;
    const x = new Audio(song);
    this.state.audio.pause();
    this.setState({ audio: x });
    setTimeout(() => {
      this.state.audio.loop = true;
      this.state.audio.play();
    }, 1000);
  };
  loadState = (val: boolean) => {
    const self = this;
    if (val === true) {
      self.setState({ loadInterval: true });
    }
    const t = setInterval(
      function () {
        if (self.state.loading === true) {
          self.setState({ loadInterval: true });
          setTimeout(
            function () {
              self.setState({ loadInterval: false });
            }.bind(self),
            1000
          );
        } else {
          clearInterval(t);
        }
      }.bind(self),
      5000
    );
    if (val === true) {
      this.playAudio();
      this.setState({ loading: true });
    } else {
      this.setState({ loading: false });
    }
  };
  updateNFTCount = async (): Promise<void> => {
    const count = await this.state.core.get_token_count();
    this.setState({ nfts: count });
  };
  buyNFT = async (e:any): Promise<void> => {
    // Loading State
    this.loadState(true);
    // core.connectWallet
    if (e === "buy-1") {
      await this.state.core.call_collect_token(1);
      await this.state.core.get_info(1);
    } else {
      await this.state.core.call_collect_token(3);
      await this.state.core.get_info(3);
    }
    if (this.state.core.collectedTokens.length > 0) {
      this.showModal(e);
    }
    this.updateNFTCount();
  };
  render() {
    const sync_text = this.state.synced ? "Unsync Wallet" : "Sync Wallet";
    return (
      <div>
        {this.state.initialloader && (
          <div className="vr vr-flex vr-flex-center vr-flex-middle initial-load">
            <div className="spinner"></div>
          </div>
        )}
        <div
          className={`vr vr-flex vr-flex-center vr-margin-top vending loading ${
            this.state.loading && "loading"
          } ${this.state.loadInterval && "hold-loader"}`}
        >
          <div className="vr vr-flex vr-flex-center">
            <div className="machine">
              <div className="vr vr-flex vr-flex-center">
                <div className="vr-wrapper vr-flex vr-flex-end">
                  <div className="sync tk-hobeaux">
                    <a
                      className="sync-text"
                      onClick={this.showModal.bind(this, "sync")}
                    >
                      {sync_text}
                    </a>
                    <a onClick={this.showModal.bind(this, "menu")}>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        width="28"
                        height="28"
                      >
                        <path fill="none" d="M0 0h24v24H0z" />
                        <path
                          d="M3 4h18v2H3V4zm0 7h18v2H3v-2zm0 7h18v2H3v-2z"
                          fill="#1cbdbd"
                        />
                      </svg>
                    </a>
                  </div>
                </div>
              </div>
              {/* <Body Frame> */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                xmlnsXlink="http://www.w3.org/1999/xlink"
                viewBox="0 0 612.48 765.4"
                className="body"
              >
                {/* Body side */}
                <use
                  href={`${machine}#machine-side`}
                  xlinkHref={`${machine}#machine-side`}
                  className="machine-side"
                />
                {/* Main frame */}
                <use
                  href={`${machine}#machine-body`}
                  xlinkHref={`${machine}#machine-body`}
                  className="machine-body"
                />
                {/* Stand */}
                <use
                  href={`${machine}#machine-stand`}
                  xlinkHref={`${machine}#machine-stand`}
                  className="machine-stand"
                />
              </svg>
              {/* Front wrapper */}
              <div className="front">
                <div className="front-mask"></div>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  xmlnsXlink="http://www.w3.org/1999/xlink"
                  viewBox="0 0 612.48 765.4"
                  className="front-svg"
                >
                  {/* Front view */}
                  <use
                    href={`${machine}#front`}
                    xlinkHref={`${machine}#front`}
                    className="front-fill"
                  />
                </svg>
                {/* Top Holder wrapper */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  xmlnsXlink="http://www.w3.org/1999/xlink"
                  viewBox="0 0 612.48 765.4"
                  className="holder"
                >
                  {/* Holder fill */}
                  <use
                    href={`${machine}#holder-fill`}
                    xlinkHref={`${machine}#holder-fill`}
                    className="holder-fill"
                  />
                  {/* Holder borders */}
                  <use
                    href={`${machine}#holder`}
                    xlinkHref={`${machine}#holder`}
                    className="holder-color"
                  />
                  {/* Holder stars */}
                  <use
                    href={`${machine}#stars-1`}
                    xlinkHref={`${machine}#stars-1`}
                    className="stars-1"
                  />
                  <use
                    href={`${machine}#stars-2`}
                    xlinkHref={`${machine}#stars-2`}
                    className="stars-2"
                  />
                  <use
                    href={`${machine}#stars-3`}
                    xlinkHref={`${machine}#stars-3`}
                    className="stars-3"
                  />
                  <use
                    href={`${machine}#stars-4`}
                    xlinkHref={`${machine}#stars-4`}
                    className="stars-4"
                  />
                  <use
                    href={`${machine}#stars-5`}
                    xlinkHref={`${machine}#stars-5`}
                    className="stars-5"
                  />
                  <use
                    href={`${machine}#stars-6`}
                    xlinkHref={`${machine}#stars-6`}
                    className="stars-6"
                  />
                </svg>
                {/* Holder Text */}
                <h1 className="holder-title tk-hobeaux">Vending NFTs</h1>
                <div className="vr vr-flex vr-flex-center">
                  <div className="equal question">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      xmlnsXlink="http://www.w3.org/1999/xlink"
                      viewBox="0 0 279.93 426.17"
                    >
                      {/* Question Fill */}
                      <use
                        href={`${machine}#question-fill`}
                        xlinkHref={`${machine}#question-fill`}
                        className="question-fill"
                      />
                      {/* Question border */}
                      <use
                        href={`${machine}#question-border`}
                        xlinkHref={`${machine}#question-border`}
                        className="question-border-fill"
                      />
                      {/* Question mark */}
                      <use
                        href={`${machine}#question`}
                        xlinkHref={`${machine}#question`}
                        className="question-mark-fill"
                      />
                    </svg>
                  </div>
                  <div className="equal actions">
                    <div className="screen-holder">
                      {/* Screen border */}
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        xmlnsXlink="http://www.w3.org/1999/xlink"
                        viewBox="0 0 612.48 765.4"
                        className="screen-svg"
                      >
                        {/* Holder borders */}
                        <use
                          href={`${machine}#holder`}
                          xlinkHref={`${machine}#holder`}
                          className="screen-effects"
                        />
                      </svg>
                      {this.state.loading ? (
                        <div className="screen digital-7 screen-text">
                          <span>
                            <div className="dot-flashing"></div>
                          </span>
                          <span>Loading ...</span>
                        </div>
                      ) : this.state.nfts > 0 ? (
                        <div className="screen digital-7 screen-text">
                          <span>{this.state.nfts}</span>
                          <span>NFTs Available</span>
                        </div>
                      ) : (
                        <div className="screen digital-7 screen-text">
                          <br />
                          <span>No NFTs Available</span>
                        </div>
                      )}
                    </div>
                    <div className="buy-buttons">
                      <button onClick={this.buyNFT.bind(this, "buy-1")}>
                        {/* Button Borders */}
                        <div className="button-fill"></div>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          xmlnsXlink="http://www.w3.org/1999/xlink"
                          viewBox="0 0 612.48 765.4"
                        >
                          {/* Holder borders */}
                          <use
                            href={`${machine}#button-border`}
                            xlinkHref={`${machine}#button-border`}
                          />
                        </svg>
                        <span className="btn-title tk-hobeaux">Buy 1</span>
                        <span className="btn-sub tk-hobeaux">2 Tez</span>
                      </button>
                      <button onClick={this.buyNFT.bind(this, "buy-3")}>
                        {/* Button Borders */}
                        <div className="button-fill"></div>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          xmlnsXlink="http://www.w3.org/1999/xlink"
                          viewBox="0 0 612.48 765.4"
                        >
                          {/* Holder borders */}
                          <use
                            href={`${machine}#button-border`}
                            xlinkHref={`${machine}#button-border`}
                            className="button-border"
                          />
                        </svg>
                        <span className="btn-title tk-hobeaux">Buy 3</span>
                        <span className="btn-sub tk-hobeaux">5 Tez</span>
                      </button>
                      <a href="https://www.wildcard.vendingnfts.xyz" className="wildcard-wrapper">
                      <svg
                          xmlns="http://www.w3.org/2000/svg"
                          xmlnsXlink="http://www.w3.org/1999/xlink"
                          viewBox="0 0 247.55 41.23"
                        >
                          {/* Wildcard BTN */}
                          <use
                            href={`${machine}#wildcard-btn`}
                            xlinkHref={`${machine}#wildcard-btn`}
                            className="wildcard-btn"
                          />
                          <use
                            href={`${machine}#wildcard-btn-border`}
                            xlinkHref={`${machine}#wildcard-btn-border`}
                            className="wildcard-btn-border"
                          />
                        </svg>
                        <span className="tk-hobeaux">TRY THE WILDCARD</span>
                        </a>
                    </div>
                  </div>
                </div>
                <div className="bottom">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    xmlnsXlink="http://www.w3.org/1999/xlink"
                    viewBox="0 0 612.48 765.4"
                  >
                    {/* Holder fill */}
                    <use
                      href={`${machine}#holder-fill`}
                      xlinkHref={`${machine}#holder-fill`}
                      className="holder-fill"
                    />
                    {/* Holder borders */}
                    <use
                      href={`${machine}#holder`}
                      xlinkHref={`${machine}#holder`}
                      className="bottom-fill"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Menu Modal */}
        <Modal
          type="home"
          show={this.state.modal}
          handleState={this.showModal}
          core={this.state.core}
          synced={this.state.synced}
        ></Modal>
      </div>
    );
  }
}