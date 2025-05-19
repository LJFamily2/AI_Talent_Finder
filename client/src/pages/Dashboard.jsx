import React from "react";
import { useAuth } from "../context/AuthContext";
import { Container, Box, Typography, Button, Paper } from "@mui/material";

const Dashboard = () => {
  const { user, logout } = useAuth();

  return (
    <>
      <Container component="main" maxWidth="md">
        <Box sx={{ mt: 4 }}>
          <Paper sx={{ p: 4 }}>
            <Typography component="h1" variant="h4" gutterBottom>
              Welcome, {user?.name}!
            </Typography>
            <Typography variant="body1" paragraph>
              You are successfully logged in to your dashboard.
            </Typography>
            <Button
              variant="contained"
              color="secondary"
              onClick={logout}
              sx={{ mt: 2 }}
            >
              Logout
            </Button>
          </Paper>
        </Box>
      </Container>

    </>
  );
};

export default Dashboard;
