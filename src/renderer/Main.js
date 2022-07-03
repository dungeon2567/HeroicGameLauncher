import { useForm, yupResolver } from "@mantine/form";
import React, { useCallback, useEffect, useState } from "react";
import { HashRouter, Route, Routes } from "react-router-dom";

import { showNotification } from "@mantine/notifications";

import { getAuth } from "firebase/auth";

import compareVersions from "compare-versions";

import * as Yup from "yup";

import {
  ActionIcon,
  Button,
  Card,
  Center,
  createStyles,
  Divider,
  Grid,
  Group,
  HoverCard,
  Image,
  Loader,
  LoadingOverlay,
  Modal,
  Paper,
  Progress,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  useMantineColorScheme,
} from "@mantine/core";

import useUser from "./lib/useUser";

import {
  Bell,
  Check,
  Error404,
  File,
  MoonStars,
  Sun,
} from "tabler-icons-react";

import useSWR, { useSWRConfig } from "swr";
import AppNavbar from "./AppNavbar";
import useConfig from "./lib/useConfig";
import UserMenu from "./UserMenu";

import FriendList from "./FriendList";

const useStyles = createStyles((theme) => ({
  root: {
    display: "grid",
    gridTemplateColumns: "240px 1fr 300px",
    gridTemplateRows: "60px 1fr 50px",
    gridGap: "20px",
    alignItems: "center",
    height: "calc(100vh - 30px)",
    width: "100vw",
    padding: "20px",
  },
  mainGrid: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gridTemplateRows: "1fr auto",
    height: "100%",
  },
  download: {
    marginTop: "20px",
    marginRight: "16px",
    display: "grid",
    gridGap: "20px",
    gridTemplateColumns: "1fr auto",
  },
  paperHeader: {
    marginRight: "16px",
    display: "flex",
    alignItems: "center",
    padding: "10px",
    "& > *": {
      marginLeft: "10px",
    },
  },
  card: {
    cursor: "pointer",
    transition: "transform 150ms ease, box-shadow 100ms ease",
    "&:hover img": {
      transform: "scale(1.02)",
    },
  },
  horizontalCard: {
    display: "grid",
    gridTemplateColumns: "3fr 2fr",
    gridTemplateRows: "1fr",
    padding: "0 !important",
  },
  main: {
    gridColumn: "2 / span 1",
    gridRow: "2 / span 1",
    width: "100%",
    display: "flex",
    flexDirection: "column",
    height: "calc(100vh - 30px - 60px - 20px - 20px - 50px)",
  },
  spacing: {
    flexGrow: "1",
  },
  header: {
    gridColumn: "1 / span 2",
    gridRow: "1 / span 1",
    height: "100%",
  },
  headerRight: {
    gridColumn: "3 / span 1",
    gridRow: "1 / span 1",
  },
  navbarLeft: {
    gridColumn: "1 / span 1",
    gridRow: "2 / span 1",
    height: "100%",
  },
  navbarRight: {
    gridColumn: "3 / span 1",
    gridRow: "2 / span 1",
    height: "100%",
  },
}));

function AnounceeCard() {
  const { classes, cx } = useStyles();

  return (
    <Grid.Col span={4}>
      <Card
        shadow="sm"
        p="lg"
        radius="md"
        withBorder
        className={cx(classes.card, {})}
      >
        <Card.Section>
          <Image
            src="https://image.api.playstation.com/cdn/UP0002/CUSA00243_00/KxUlIjbtqJ7GPwCzjtKnS4GTDP6JSgib.png"
            height={160}
            alt="Norway"
          />
        </Card.Section>

        <Stack spacing={10} pt={20}>
          <Text weight={500}>Diablo III</Text>

          <Text size="sm" color="dimmed">
            Pre purchase now
          </Text>
        </Stack>
      </Card>
    </Grid.Col>
  );
}

function MainAnounceeCard() {
  const { classes, cx } = useStyles();

  return (
    <Grid.Col span={12}>
      <Card
        shadow="sm"
        p="lg"
        radius="md"
        withBorder
        className={cx(classes.card, {
          [classes.horizontalCard]: true,
        })}
      >
        <Image
          src="https://image.api.playstation.com/cdn/UP0002/CUSA00243_00/KxUlIjbtqJ7GPwCzjtKnS4GTDP6JSgib.png"
          height={220}
          alt="Norway"
        />

        <Stack spacing={20} p={20}>
          <Text weight={500}>Norway Fjord Adventures</Text>

          <Text size="sm" color="dimmed">
            With Fjord Tours you can explore more of the magical fjord
            landscapes with tours and activities on and around the fjords of
            Norway
          </Text>
        </Stack>
      </Card>
    </Grid.Col>
  );
}

function UserModalForm({ onClose, config, mergeConfig, gameName }) {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("Compressing files");

  const schema = Yup.object().shape({
    folder: Yup.string().min(3, "This field is required."),
    executable: Yup.string().min(3, "This field is required."),
    version: Yup.string()
      .min(3, "This field is required.")
      .test(
        "compareVersion",
        "This version is older or equal to the current version.",
        (value) =>
          config?.version
            ? compareVersions.validate(value) &&
              compareVersions(config.version, value) < 0
            : true
      )
      .test("validateVersion", "Invalid version string.", (value) =>
        compareVersions.validate(value)
      ),
  });

  const { mutate } = useSWRConfig();

  const form = useForm({
    initialValues: {
      folder: config.uploadFolder || "",
      executable: config.executable || "",
      version: config.version || "",
    },

    validate: yupResolver(schema),
  });

  return (
    <form
      onSubmit={form.onSubmit(async (values) => {
        if (
          await window.api.fileExists(`${values.folder}\\${values.executable}`)
        ) {
          setLoading(true);

          const oldConfig = {
            executable: config?.executable,
            version: config?.version,
          };

          let from = {};

          try {
            setProgress(0);

            setProgressText("Checking current files");

            window.api.receive("__progress", (data) => {
              setProgress(parseFloat(data));

              setProgressText(`Checking current files - ${data}%`);
            });

            window.api.removeAll("__progress");

            setProgress(0);

            setProgressText("Cleaning build files");

            await window.api.cleanBuild();

            /*  Create diff here */

            if (config?.version != null) {
              setProgressText("Computing diff files (this can take a while).");
              setProgress(-1);

              await window.api.diffBuild(
                values.folder,
                gameName,
                config.version,
                values.version
              );

              from[config.version] = `PATCH_${config.version
                .replace(".", "_")
                .replace(".", "_")}_TO_${values.version
                .replace(".", "_")
                .replace(".", "_")}.bin`;
            }

            /* End diff system */

            window.api.receive("__progress", (data) => {
              setProgress(parseFloat(data));

              setProgressText(`Calculating hashes of files - ${data}%`);
            });

            setProgressText("Calculating hashes of files - 0%");

            const hashes = await window.api.hashBuild(values.folder);

            window.api.removeAll("__progress");

            window.api.receive("__progress", (data) => {
              setProgress(parseFloat(data));

              setProgressText(`Compressing files - ${data}%`);
            });

            setProgressText("Compressing files - 0%");

            const files = await window.api.compressBuild(
              values.version,
              values.folder
            );

            window.api.removeAll("__progress");

            const uploadFiles = [
              ...files,
              ...Object.values(from).map((val) => `temp/${val}`),
            ];

            for (let it = 0; it < uploadFiles.length; ++it) {
              window.api.receive("__progress", (data) => {
                setProgress(parseFloat(data));

                setProgressText(
                  `Uploading files - ${Math.floor(data)}% (${it + 1}/${
                    uploadFiles.length
                  })`
                );
              });

              setProgressText(
                `Uploading compressed - 0% (${it + 1}/${uploadFiles.length})`
              );

              await window.api.uploadBuild(uploadFiles[it], gameName);

              window.api.removeAll("__progress");
            }

            setProgress(0);

            setProgressText("Cleaning compressed files");

            await window.api.cleanBuild();

            await window.api.uploadManifest(
              gameName,
              files,
              values.version,
              values.executable,
              hashes,
              from
            );

            mutate(
              `https://file-service-worker.worlds-embrace.workers.dev/${gameName}/manifest.json`
            );

            onClose();
          } finally {
            window.api.removeAll("__progress");

            setLoading(false);
          }
        } else {
          form.setFieldError("executable", "This file does not exists.");
        }
      })}
    >
      <Stack>
        <TextInput
          {...form.getInputProps("folder")}
          required
          rightSection={
            <ActionIcon
              onClick={() => {
                window.api.selectFolder().then((result) => {
                  form.setFieldValue("folder", result);
                });
              }}
            >
              <File size={16} />
            </ActionIcon>
          }
          placeholder="Game folder"
        />

        <TextInput
          {...form.getInputProps("executable")}
          placeholder="Executable file name"
          required
        />

        <TextInput
          {...form.getInputProps("version")}
          placeholder="Game version"
          required
        />

        <Group position="right">
          <Button type="submit">Upload</Button>
        </Group>
      </Stack>

      <LoadingOverlay
        visible={loading}
        loader={
          <>
            <Text align="center" pb={10}>
              {progressText}
            </Text>
            {progress == -1 ? (
              <Center>
                <Loader />
              </Center>
            ) : (
              <Progress size="xl" style={{ width: 300 }} value={progress} />
            )}
          </>
        }
        overlayBlur={2}
      />
    </form>
  );
}

function UserModalContent({ onClose }) {
  const { config, mergeConfig, gameName } = useConfig();

  if (config) {
    return (
      <UserModalForm
        onClose={onClose}
        config={config}
        gameName={gameName}
        mergeConfig={mergeConfig}
      />
    );
  } else {
    return <LoadingOverlay visible={true} overlayBlur={2} />;
  }
}

function Main() {
  let { user, loading } = useUser();
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const { classes, cx } = useStyles();
  const [opened, setOpened] = useState(false);
  const [canPlay, setCanPlay] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [downloadLoading, setDownloadLoading] = useState(true);

  const { config, mergeConfig, gameName } = useConfig();

  const { data, error } = useSWR(
    gameName
      ? `https://file-service-worker.worlds-embrace.workers.dev/${gameName}/manifest.json`
      : null,
    (url) =>
      fetch(url)
        .then((response) => response.json().then((value) => value || {}))
        .catch((err) => ({}))
  );

  async function play() {
    setDownloadLoading(true);

    try {
      await window.api.play(
        gameName,
        config.executable,
        getAuth().currentUser.stsTokenManager.accessToken,
        getAuth().currentUser.stsTokenManager.refreshToken
      );
    } finally {
      setDownloadLoading(false);
    }
  }

  async function download() {
    setDownloadLoading(true);

    try {
      setProgressText("Cleaning temp files");

      await window.api.cleanBuild();

      if (config?.version in data.from) {
        window.api.receive("__progress", (progress) => {
          setDownloadProgress(parseFloat(progress));

          setProgressText(`Downloading file - ${Math.floor(progress)}%`);
        });

        setProgressText(`Downloading file - 0%`);

        await window.api.downloadBuild(data.from[config?.version], gameName);

        window.api.removeAll("__progress");

        setDownloadProgress(-1);

        setProgressText(`Installing (this can take a while).`);

        await window.api.upgradeBuild(gameName, config?.version, data.version);

        mergeConfig({
          version: data.version,
          executable: data.executable,
        });

        setProgressText("Cleaning temp files");

        await window.api.cleanBuild();

        setDownloadProgress(0);

        setCanPlay(true);
      } else {
        for (let it = 0; it < data.files.length; ++it) {
          window.api.receive("__progress", (progress) => {
            setDownloadProgress(parseFloat(progress));

            setProgressText(
              `Downloading files - ${Math.floor(progress)}% (${it + 1}/${
                data.files.length
              })`
            );
          });

          setProgressText(
            `Downloading files - 0% (${it + 1}/${data.files.length})`
          );

          await window.api.downloadBuild(data.files[it], gameName);

          window.api.removeAll("__progress");
        }

        setProgressText("Removing game files");
        setDownloadProgress(0);

        mergeConfig({
          version: null,
        });

        await window.api.removeBuild(gameName);

        setDownloadProgress(0);

        window.api.receive("__progress", (progress) => {
          setDownloadProgress(parseFloat(progress));

          setProgressText(`Installing - ${Math.floor(progress)}%`);
        });

        setProgressText(`Installing - 0%`);

        await window.api.installBuild(gameName, data.version);

        mergeConfig({
          version: data.version,
          executable: data.executable,
        });

        setDownloadProgress(0);

        setCanPlay(true);
      }
    } finally {
      setDownloadLoading(false);

      setProgressText("Cleaning build files");

      window.api.removeAll("__progress");

      setProgressText(null);

      await window.api.cleanBuild();
    }
  }

  async function repairAndShowNotification(event) {
    repair(event, () => {
      showNotification({
        title: "Latest version",
        message: "You already have the latest game version.",
        autoClose: true,
        color: "green",
        icon: <Check />,
      });
    });
  }

  async function repair(event, onError) {
    if (data.version != null) {
      if (config.version == data.version) {
        setDownloadLoading(true);
        setProgressText("Repairing...");

        let needsDownload = false;

        try {
          const hashes = await window.api.hashBuild(`./Games/${gameName}`);

          for (let key of Object.keys(data.sha256)) {
            if (key in hashes) {
              if (hashes[key] != data.sha256[key]) {
                needsDownload = true;
                break;
              }
            } else {
              needsDownload = true;
              break;
            }
          }
        } finally {
          setProgressText(null);
          setDownloadLoading(false);
        }

        if (needsDownload) {
          await download();
        } else {
          if (onError) {
            onError();
          }
        }
      } else {
        await download();
      }
    }
  }

  useEffect(() => {
    if (data || error) {
      setCanPlay(config?.version == data?.version);

      setDownloadLoading(data?.version == null && config?.version != null);
    }
  }, [data, config]);

  useEffect(() => {
    if (data != null && data?.version == null && mergeConfig) {
      mergeConfig({
        version: null,
        executable: null,
      });
    }
  }, [data, mergeConfig]);

  return (
    <>
      <HashRouter>
        <div className={classes.root}>
          <aside className={classes.navbarLeft}>
            <AppNavbar />
          </aside>
          <aside className={classes.navbarRight}>
            <FriendList />
          </aside>
          <header className={classes.header}>
            <Paper className={classes.paperHeader} withBorder shadow="md">
              <div className={classes.spacing} />

              <ActionIcon
                onClick={() => toggleColorScheme()}
                size="lg"
                p={4}
                sx={(theme) => ({
                  backgroundColor:
                    theme.colorScheme === "dark"
                      ? theme.colors.dark[6]
                      : theme.colors.gray[0],
                  color:
                    theme.colorScheme === "dark"
                      ? theme.colors.yellow[4]
                      : theme.colors.blue[6],
                })}
              >
                {colorScheme === "dark" ? (
                  <Sun size={32} />
                ) : (
                  <MoonStars size={32} />
                )}
              </ActionIcon>
              <HoverCard width={280} shadow="md" openDelay={300} withArrow>
                <HoverCard.Target>
                  <ActionIcon p={4} size="lg">
                    <Bell />
                  </ActionIcon>
                </HoverCard.Target>

                <HoverCard.Dropdown>
                  <Group position="apart" m={10}>
                    <Text weight={500}>Notifications</Text>
                  </Group>
                  <Divider />
                </HoverCard.Dropdown>
              </HoverCard>
            </Paper>
          </header>
          <header className={classes.headerRight}>
            <UserMenu
              openUploadModal={() => {
                if (config?.version == data?.version) {
                  setOpened(true);
                } else {
                  showNotification({
                    title: "Error",
                    message: "Please update current version to latest first!",
                    autoClose: true,
                    color: "red",
                    icon: <Error404 />,
                  });
                }
              }}
            />
          </header>
          <main className={classes.main}>
            <Routes>
              <Route
                path="/"
                element={
                  <div className={classes.mainGrid}>
                    <ScrollArea offsetScrollbars scrollbarSize={16}>
                      <Grid>
                        <MainAnounceeCard />
                        <AnounceeCard />
                        <AnounceeCard />
                        <AnounceeCard />
                      </Grid>
                    </ScrollArea>

                    <div className={classes.download}>
                      <Center>
                        <div style={{ width: "100%" }}>
                          <Text align="center" pb={10}>
                            {progressText ||
                              (config && config.version
                                ? `Version - ${config.version}`
                                : undefined)}
                          </Text>
                          {downloadProgress < 0 ? (
                            <Progress
                              value={100}
                              size={26}
                              radius="xl"
                              animate
                              style={{ width: "100%" }}
                            />
                          ) : (
                            <Progress
                              value={downloadProgress}
                              size={26}
                              radius="xl"
                              style={{ width: "100%" }}
                            />
                          )}
                        </div>
                      </Center>
                      <Center>
                        {canPlay && data.version ? (
                          <Button.Group orientation="vertical">
                            <Button
                              size="sm"
                              loading={downloadLoading}
                              onClick={play}
                            >
                              Play
                            </Button>
                            <Button
                              size="sm"
                              variant="default"
                              loading={downloadLoading}
                              onClick={repairAndShowNotification}
                            >
                              Repair
                            </Button>
                          </Button.Group>
                        ) : (
                          <Button
                            size="xl"
                            loading={downloadLoading}
                            onClick={download}
                            disabled={data?.version == null}
                          >
                            {config?.version == null ? "Install" : "Update"}
                          </Button>
                        )}
                      </Center>
                    </div>
                  </div>
                }
              />
            </Routes>
          </main>
        </div>
      </HashRouter>

      <Modal
        opened={opened}
        closeOnClickOutside={false}
        closeOnEscape={false}
        onClose={() => setOpened(false)}
        title="Upload new game version"
        centered
      >
        <UserModalContent onClose={useCallback(() => setOpened(false))} />
      </Modal>
    </>
  );
}

export default React.memo(Main);
