ARG RUNNER_IMAGE
FROM ${RUNNER_IMAGE}
RUN apt-get update \
    && apt-get install -y --no-install-recommends xvfb x11vnc novnc websockify openbox x11-utils x11-xserver-utils \
    && rm -rf /var/lib/apt/lists/*
RUN mkdir -p /tmp/.X11-unix && chmod 1777 /tmp/.X11-unix
ENV CYPRESS_CACHE_FOLDER=/opt/cypress
ENV DISPLAY=:99
WORKDIR /workspace
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund && chmod -R a+rwX /opt/cypress
ENV PATH=/workspace/node_modules/.bin:$PATH
COPY docker/runner/desktop.sh /opt/magelens/desktop.sh
COPY docker/runner/healthcheck.cjs /opt/magelens/healthcheck.cjs
HEALTHCHECK --interval=3s --timeout=3s --start-period=10s --retries=20 \
    CMD xdpyinfo -display "$DISPLAY" >/dev/null 2>&1 && node /opt/magelens/healthcheck.cjs
CMD ["bash", "/opt/magelens/desktop.sh"]
