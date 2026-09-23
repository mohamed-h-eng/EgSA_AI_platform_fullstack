Put extra CA certificates (`*.crt`, PEM format) here if the network re-signs HTTPS traffic
(TLS inspection). The Docker build installs them so `uv` can download packages.
Leave the folder with only this README otherwise. `*.crt` files are git-ignored.
