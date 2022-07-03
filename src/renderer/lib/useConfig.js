import { atom, selector, useRecoilState, useRecoilValue } from "recoil";

const configState = atom({
  key: "config",
  default: window.api ? window.api.storeGet("Zomfi") : {},
});

const gameNameState = atom({
  key: "gameName",
  default: "Zomfi",
});

export default function useConfig() {
  const [gameName, setGameName] = useRecoilState(gameNameState);
  const [config, setConfig] = useRecoilState(configState);

  function mergeConfig(value) {
    window.api.storeMerge(gameName, value).then((data) => {
      setConfig(data);
    });
  }

  return {
    gameName,
    config,
    mergeConfig,
  };
}
