resource "null_resource" "remote_system_info_yathish" {
  connection {
    type        = "ssh"
    host        = "192.168.219.52"
    user        = "yathish.kumar"
    private_key = file("~/.ssh/id_rsa")
  }

  provisioner "remote-exec" {
    inline = [
      "echo 'Checking server: 192.168.219.52'",

      # CPU load average
      "LOAD=$(uptime | awk -F'load average:' '{ print $2 }' | cut -d, -f1 | tr -d ' ')",
      "echo CPU Load Average: $${LOAD}",
      "awk 'BEGIN {exit !($$LOAD > 1.0)}' && echo '[ALERT] High CPU load!' || echo 'CPU load normal'",

      # Memory usage
      "MEM_USAGE=$(free | awk '/Mem/{printf(\"%d\"), $$3/$$2*100}')",
      "echo Memory Usage: $${MEM_USAGE}%",
      "awk 'BEGIN {exit !($$MEM_USAGE > 80)}' && echo '[ALERT] High memory usage!' || echo 'Memory usage normal'",

      # Disk usage for root /
      "DISK=$(df / | awk 'NR==2 {print $$5}' | tr -d '%')",
      "echo Disk Usage: $${DISK}%",
      "awk 'BEGIN {exit !($$DISK > 90)}' && echo '[ALERT] High disk usage!' || echo 'Disk usage normal'",

      # I/O stats (requires sysstat installed)
      "echo 'I/O Stats:'",
      "iostat -dx 1 1 || echo 'iostat command not found, install sysstat package for I/O stats'"
    ]
  }
}

