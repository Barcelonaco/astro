<?php

/**
 * Lightweight SMTP mailer — envoie un email HTML via SMTP (TLS/SSL/none).
 * Pas de dépendance externe, utilise stream_socket_client + STARTTLS.
 *
 * @param array  $config  ['host','port','username','password','from_email','from_name','encryption']
 * @param string $to      Adresse destinataire
 * @param string $subject Sujet
 * @param string $html    Corps HTML
 * @throws RuntimeException en cas d'échec
 */
function smtp_send_mail(array $config, string $to, string $subject, string $html): void {
    $host = $config['host'];
    $port = (int) $config['port'];
    $username = $config['username'] ?? '';
    $password = $config['password'] ?? '';
    $fromEmail = $config['from_email'] ?: $username;
    $fromName = $config['from_name'] ?? '';
    $encryption = $config['encryption'] ?? 'tls';

    // Connexion
    $timeout = 10;
    $context = stream_context_create([
        'ssl' => [
            'verify_peer' => false,
            'verify_peer_name' => false,
            'allow_self_signed' => true,
        ],
    ]);

    $prefix = ($encryption === 'ssl') ? 'ssl://' : '';
    $socket = @stream_socket_client(
        "{$prefix}{$host}:{$port}",
        $errno,
        $errstr,
        $timeout,
        STREAM_CLIENT_CONNECT,
        $context
    );

    if (!$socket) {
        throw new RuntimeException("Connexion SMTP impossible : {$errstr} ({$errno})");
    }

    stream_set_timeout($socket, $timeout);

    // Lire le greeting
    smtp_read($socket, 220);

    // EHLO
    smtp_write($socket, "EHLO " . gethostname());
    smtp_read($socket, 250);

    // STARTTLS si demandé
    if ($encryption === 'tls') {
        smtp_write($socket, "STARTTLS");
        smtp_read($socket, 220);
        $crypto = stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT | STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT);
        if (!$crypto) {
            throw new RuntimeException("STARTTLS echoue");
        }
        // Re-EHLO apres TLS
        smtp_write($socket, "EHLO " . gethostname());
        smtp_read($socket, 250);
    }

    // AUTH LOGIN (si identifiants fournis)
    if ($username !== '' && $password !== '') {
        smtp_write($socket, "AUTH LOGIN");
        smtp_read($socket, 334);
        smtp_write($socket, base64_encode($username));
        smtp_read($socket, 334);
        smtp_write($socket, base64_encode($password));
        smtp_read($socket, 235);
    }

    // MAIL FROM
    smtp_write($socket, "MAIL FROM:<{$fromEmail}>");
    smtp_read($socket, 250);

    // RCPT TO
    smtp_write($socket, "RCPT TO:<{$to}>");
    smtp_read($socket, 250);

    // DATA
    smtp_write($socket, "DATA");
    smtp_read($socket, 354);

    // Headers + body
    $fromHeader = $fromName
        ? "=?UTF-8?B?" . base64_encode($fromName) . "?= <{$fromEmail}>"
        : $fromEmail;

    $boundary = '----=_Part_' . md5(uniqid((string) mt_rand(), true));
    $messageId = '<' . md5(uniqid((string) mt_rand(), true)) . '@' . gethostname() . '>';

    $headers = implode("\r\n", [
        "Message-ID: {$messageId}",
        "Date: " . date('r'),
        "From: {$fromHeader}",
        "To: {$to}",
        "Subject: =?UTF-8?B?" . base64_encode($subject) . "?=",
        "MIME-Version: 1.0",
        "Content-Type: text/html; charset=UTF-8",
        "Content-Transfer-Encoding: base64",
    ]);

    $body = $headers . "\r\n\r\n" . chunk_split(base64_encode($html)) . "\r\n.";
    smtp_write($socket, $body);
    smtp_read($socket, 250);

    // QUIT
    smtp_write($socket, "QUIT");
    @fclose($socket);
}

/** Envoie une commande SMTP. */
function smtp_write($socket, string $data): void {
    fwrite($socket, $data . "\r\n");
}

/** Lit la réponse SMTP et vérifie le code attendu. */
function smtp_read($socket, int $expectedCode): string {
    $response = '';
    while ($line = fgets($socket, 512)) {
        $response .= $line;
        // Dernier ligne: code suivi d'un espace (pas d'un tiret)
        if (isset($line[3]) && $line[3] === ' ') break;
        // Timeout check
        $info = stream_get_meta_data($socket);
        if ($info['timed_out']) {
            throw new RuntimeException("SMTP timeout");
        }
    }

    $code = (int) substr($response, 0, 3);
    if ($code !== $expectedCode) {
        throw new RuntimeException("SMTP erreur : attendu {$expectedCode}, recu {$code} — " . trim($response));
    }

    return $response;
}
