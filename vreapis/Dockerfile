FROM python:3.13.7-slim

WORKDIR /app

RUN apt update && \
    apt install -y libpq-dev gcc gdal-bin curl net-tools iputils-ping

RUN python3 -m venv /opt/venv
RUN /opt/venv/bin/pip install pip --upgrade

COPY ./requirements.txt /app
RUN /opt/venv/bin/pip install -r requirements.txt

COPY . /app
RUN chmod +x entrypoint.sh

CMD ["/app/entrypoint.sh"]
