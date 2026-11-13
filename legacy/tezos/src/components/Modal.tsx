import DonateArt from "./DonateArt";

interface ModalProps {
  type:any,
  handleState:any,
  show:any,
  core:any,
  synced:any
}

const Modal = ({type, handleState, show, core, synced}:ModalProps) => {
  const showIOcheckout = true
  const showHideClassName = show && show !== "" ? "modal-on" : "";
  const max50 =
    show && show !== "buy-1" && show !== "donate" && show !== "buy-3"
      ? "max-520"
      : "";
  // Switch Theme
  const switchTheme = (val: string) => {
    localStorage.setItem("theme", val);
    document.body.removeAttribute("class");
    document.body.classList.add(val!);
    handleState("");
  };

  const tokenData =
    show == "buy-1" || show == "buy-3" ? core.collectedTokens : "";

  return (
    <div
      className={`vr vr-flex vr-flex-center vending-modal ${showHideClassName} ${
        show === "about" ? "about-modal" : ""
      } ${
        show === "buy-1" || show === "buy-3" || show === "donate"
          ? "dark-modal vending-pad-top"
          : ""
      }`}
    >
      <div className={`modal-content ${max50}`}>
        <div className="vr vr-flex vr-flex-center">
          <div className="close">
            <a onClick={() => handleState("")}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="44"
                height="44"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#ffffff"
              >
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </a>
          </div>
        </div>
        {(() => {
          if (show === "menu") {
            return (
              <ul className="menu-items">
                <li>
                  <a href="/">Home</a>
                </li>
                <li>
                  <a onClick={() => handleState("about")}>About</a>
                </li>
                <li>
                  <a onClick={() => handleState("donate")}>Donate Art</a>
                </li>
                <li>
                  <a href="https://www.wildcard.vendingnfts.xyz">Wildcard</a>
                </li>
                {type === "home" && (
                  <div>
                    <li>
                      <a onClick={() => switchTheme("dark-theme")}>Dark Mode</a>
                    </li>
                    <li>
                      <a onClick={() => switchTheme("light-theme")}>
                        Light Mode
                      </a>
                    </li>
                  </div>
                )}
              </ul>
            );
          } else if (show === "sync") {
            return (
              <ul className="menu-items">
                {synced ? (
                  <li>
                    <a onClick={core.disconnectWallet}>Disconnect wallet</a>
                  </li>
                ) : (
                  <>
                    <li>
                      <a>Install Temple</a>
                    </li>
                    <li>
                      <a onClick={core.connectWallet}>Connect wallet</a>
                    </li>
                  </>
                )}
              </ul>
            );
          } else if (show === "donate") {
            return (
              <div className="vr vr-flex vr-flex-center">
                <div className="form-card">
                  <div className="form-card-title">
                    <span className="tk-hobeaux">
                      Load Art into Vending Machine
                    </span>
                    <div className="form-wrapper">
                      <DonateArt core={core} />
                    </div>
                  </div>
                </div>
              </div>
            );
          } else if (show === "about") {
            return (
              <div className="about">
                <h2 className="about-head">About Us</h2>
                <p className="info tk-tablet-gothic">
                  Artist (or collectors) will donate pieces to the vending
                  machine, this can be any piece they’ve minted or purchased on
                  other platforms such as TEIA and OBJKT which they then will
                  use the VEN platform UI to send pieces to the machine
                  contract. In this way they can set their secondary royalties
                  accordingly and make them widely available to a new audience
                  base that normally wouldn’t know where to look for or collect
                  their work. The art will then be distributed to collectors
                  randomly for 2 TEZ or 3 pieces for 5. Half of all these
                  proceed will then be used to offer TEZOS based initiatives
                  such as marketing drives and free mints to onboard new artist
                  onto TEZ. The VEN contract is such that in the future we can
                  upgrade the UI to accommodate a free mint function to VEN
                  contract right within the page, this will be a potential
                  further iteration as we grow and advance concept.
                </p>
                <h2 className="team-head">Team</h2>
                <ul className="team-structure">
                  <li className="tk-tablet-gothic">
                    <a
                      href="https://twitter.com/RexFlexasaurus"
                      target="_blank"
                    >
                      <span>Project Manager and Concept:</span> @FlexaSaurusREX
                    </a>
                  </li>
                  <li className="tk-tablet-gothic">
                    <a href="https://twitter.com/mightymoss" target="_blank">
                      <span>Art Direction/Design/UX:</span> @mightymoss
                    </a>
                  </li>
                  <li className="tk-tablet-gothic">
                    <a href="https://twitter.com/landlinesart1" target="_blank">
                      <span>Contract/Backend Dev:</span> @landlinesart1
                    </a>
                  </li>
                  <li className="tk-tablet-gothic">
                    <a href="https://twitter.com/WRILBEN" target="_blank">
                      <span>Frontend Dev/UX/UI Design:</span> @WRILBEN
                    </a>
                  </li>
                  <li className="tk-tablet-gothic">
                    <a href="https://twitter.com/FENDELMARC" target="_blank">
                      <span>Music:</span> @FENDELMARC
                    </a>
                  </li>
                  <li className="tk-tablet-gothic">
                    <a href="https://twitter.com/uczine" target="_blank">
                      <span>Gif Wizard:</span> @uczine
                    </a>
                  </li>
                </ul>
              </div>
            );
          } else if (show === "buy-1") {
            return (
              <div>
                <div className="vr vr-flex vr-flex-center">
                  {tokenData.map(function (item:any, index:any) {
                    return (
                      <div key={index} className="card">
                        <div className="card-img">
                          <a href={(`https://objkt.com/tokens/${item.fa2}/${item.tokenId}`)} target="_blank" >
                            <img src={item.image} />
                          </a>
                        </div>
                        <span className="info-x tk-tablet-gothic">
                          {item.name}
                        </span>
                        <span className="info-green tk-tablet-gothic">
                          OBKJT
                        </span>
                        {showIOcheckout ? <io-print-button
                            asset-url={item.io_image}
                            redirect-url={(`https://objkt.com/tokens/${item.fa2}/${item.tokenId}`)}
                            contract-id={item.fa2}
                            token-id={item.tokenId}
                            owner-id={core.state.userAddress}
                            item-title={item.name}
                            >
                        </io-print-button> : ""}
                      </div>
                    );
                  })}
                </div>
                <p className="alert-text">
                  MAKE SURE TO VERIFY YOUR TRANSACTION WAS SUCCESSFUL OTHERWISE
                  YOU DID NOT RECEIVE THE NFTS AS SHOWN
                </p>
              </div>
            );
          } else if (show === "buy-3") {
            return (
              <div>
                <div className="vr vr-flex vr-flex-center">
                  {tokenData.map(function (item:any, index:any) {
                    return (
                      <div key={index} className="card">
                        <div className="card-img">
                          <a href={(`https://objkt.com/tokens/${item.fa2}/${item.tokenId}`)} target="_blank" >
                            <img src={item.image} />
                          </a>
                        </div>
                        <span className="info-x tk-tablet-gothic">
                          {item.name}
                        </span>
                        <span className="info-green tk-tablet-gothic">
                          OBKJT
                        </span>
                        {showIOcheckout ? <io-print-button
                            asset-url={item.io_image}
                            redirect-url={(`https://objkt.com/tokens/${item.fa2}/${item.tokenId}`)}
                            contract-id={item.fa2}
                            token-id={item.tokenId}
                            owner-id={core.state.userAddress}
                            item-title={item.name}
                            >
                        </io-print-button> : ""}
                      </div>
                    );
                  })}
                </div>
                <p className="alert-text">
                  MAKE SURE TO VERIFY YOUR TRANSACTION WAS SUCCESSFUL OTHERWISE
                  YOU DID NOT RECEIVE THE NFTS AS SHOWN
                </p>
              </div>
            );
          }
        })()}
      </div>
    </div>
  );
};
export default Modal;
