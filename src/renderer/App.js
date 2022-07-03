import {
  ActionIcon
} from "@mantine/core";
import { hideNotification, showNotification } from "@mantine/notifications";
import React from "react";
import useUser from "./lib/useUser";
import Login from "./Login";
import Main from "./Main";

import { Refresh } from "tabler-icons-react";


if (window.api) {
  window.api.receive("update_downloaded", (data) => {
    showNotification({
      id: "update-available",
      title: "Update available",
      message: "A new version is available. Click to update.",
      autoClose: false,
      disallowClose: true,
      color: "teal",
      icon: (
        <ActionIcon
          variant="filled"
          color="primary"
          size="lg"
          onClick={() => {
            if (window.api) {
              window.api.send("restart_app", {});
            }

            hideNotification("update-available");
          }}
        >
          <Refresh />
        </ActionIcon>
      ),
      className: "my-notification-class",
    });
  });
}

function App() {
  const { user, loading } = useUser();

  if (loading) {
    return null;
  } else if (!user) {
    return <Login />;
  } else {
    return <Main />;
  }
}

export default React.memo(App);
