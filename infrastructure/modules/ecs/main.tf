# ── Shared IAM assume-role document ──────────────────────────────────────────

data "aws_iam_policy_document" "ecs_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

# ── Per-service IAM ───────────────────────────────────────────────────────────

resource "aws_iam_role" "task_execution" {
  for_each           = var.services
  name               = "${var.name}-${each.key}-exec-role"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume_role.json
  tags               = var.tags
}

resource "aws_iam_role_policy_attachment" "task_execution_managed" {
  for_each   = var.services
  role       = aws_iam_role.task_execution[each.key].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "secrets_read" {
  for_each = {
    for k, v in var.services : k => v
    if length(v.secret_arns) > 0 || v.ghcr_secret_arn != ""
  }
  name = "${var.name}-${each.key}-secrets"
  role = aws_iam_role.task_execution[each.key].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = ["secretsmanager:GetSecretValue"]
      Resource = concat(
        values(each.value.secret_arns),
        each.value.ghcr_secret_arn != "" ? [each.value.ghcr_secret_arn] : [],
      )
    }]
  })
}

resource "aws_iam_role" "task" {
  for_each           = var.services
  name               = "${var.name}-${each.key}-task-role"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume_role.json
  tags               = var.tags
}

# ── Per-service CloudWatch log groups ─────────────────────────────────────────

resource "aws_cloudwatch_log_group" "this" {
  for_each          = var.services
  name              = "/ecs/${var.name}/${each.key}"
  retention_in_days = each.value.log_retention_days
  tags              = var.tags
}

# ── Shared ECS cluster ────────────────────────────────────────────────────────

resource "aws_ecs_cluster" "this" {
  name = "${var.name}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = var.tags
}

resource "aws_ecs_cluster_capacity_providers" "this" {
  cluster_name       = aws_ecs_cluster.this.name
  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    capacity_provider = "FARGATE_SPOT"
    weight            = 7
    base              = 0
  }

  default_capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight            = 3
    base              = 1
  }
}

# ── Per-service task definitions ──────────────────────────────────────────────

resource "aws_ecs_task_definition" "this" {
  for_each                 = var.services
  family                   = "${var.name}-${each.key}"
  cpu                      = each.value.cpu
  memory                   = each.value.memory
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  execution_role_arn       = aws_iam_role.task_execution[each.key].arn
  task_role_arn            = aws_iam_role.task[each.key].arn

  container_definitions = jsonencode([
    merge(
      {
        name      = each.key
        image     = "${each.value.image}:${each.value.image_tag}"
        essential = true

        portMappings = [
          { containerPort = each.value.container_port, protocol = "tcp" }
        ]

        environment = [
          for k, v in each.value.env_vars : { name = k, value = v }
        ]

        secrets = [
          for k, v in each.value.secret_arns : { name = k, valueFrom = v }
        ]

        healthCheck = {
          command     = ["CMD-SHELL", "curl -f http://localhost:${each.value.container_port}${each.value.health_check_path} || exit 1"]
          interval    = 30
          timeout     = 5
          retries     = 3
          startPeriod = 15
        }

        logConfiguration = {
          logDriver = "awslogs"
          options = {
            "awslogs-group"         = aws_cloudwatch_log_group.this[each.key].name
            "awslogs-region"        = var.aws_region
            "awslogs-stream-prefix" = "ecs"
          }
        }
      },
      each.value.ghcr_secret_arn != "" ? {
        repositoryCredentials = { credentialsParameter = each.value.ghcr_secret_arn }
      } : {},
    )
  ])

  tags = var.tags
}

# ── Shared ALB ────────────────────────────────────────────────────────────────

resource "aws_lb" "this" {
  name               = "${var.name}-alb"
  internal           = var.internal
  load_balancer_type = "application"
  security_groups    = [var.alb_security_group_id]
  subnets            = var.internal ? var.private_subnet_ids : var.public_subnet_ids

  enable_deletion_protection = var.enable_deletion_protection

  tags = var.tags
}

# Internal: single HTTP listener; default action returns 404 when no rule matches.
# External: HTTP redirects to HTTPS; HTTPS listener carries the listener rules.

resource "aws_lb_listener" "http" {
  count             = var.internal ? 1 : 0
  load_balancer_arn = aws_lb.this.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "fixed-response"
    fixed_response {
      content_type = "application/json"
      message_body = "{\"message\":\"not found\"}"
      status_code  = "404"
    }
  }
}

resource "aws_lb_listener" "http_redirect" {
  count             = var.internal ? 0 : 1
  load_balancer_arn = aws_lb.this.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

resource "aws_lb_listener" "https" {
  count             = var.internal ? 0 : 1
  load_balancer_arn = aws_lb.this.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.acm_certificate_arn

  default_action {
    type = "fixed-response"
    fixed_response {
      content_type = "application/json"
      message_body = "{\"message\":\"not found\"}"
      status_code  = "404"
    }
  }
}

locals {
  # The listener that carries the per-service forward rules
  active_listener_arn = var.internal ? aws_lb_listener.http[0].arn : aws_lb_listener.https[0].arn

  # Only services with a path_prefix get ALB wiring
  routed_services = {
    for k, v in var.services : k => v if v.path_prefix != null
  }

  # Stable alphabetical priority assignment (lowest index = highest priority)
  service_priorities = {
    for idx, key in sort(keys(local.routed_services)) : key => idx + 1
  }
}

# ── Per-service ALB target groups + listener rules ────────────────────────────

resource "aws_lb_target_group" "this" {
  for_each    = local.routed_services
  name        = "${var.name}-${each.key}-tg"
  port        = each.value.container_port
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    path                = each.value.health_check_path
    healthy_threshold   = 2
    unhealthy_threshold = 3
    interval            = 30
    timeout             = 5
    matcher             = "200"
  }

  tags = var.tags
}

resource "aws_lb_listener_rule" "this" {
  for_each     = local.routed_services
  listener_arn = local.active_listener_arn
  priority     = local.service_priorities[each.key]

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.this[each.key].arn
  }

  condition {
    path_pattern {
      # "/" is a catch-all; other prefixes match exactly and with a trailing slash
      values = each.value.path_prefix == "/" ? ["/*", "/"] : [
        each.value.path_prefix,
        "${each.value.path_prefix}/*",
      ]
    }
  }
}

# ── Per-service ECS services ──────────────────────────────────────────────────

resource "aws_ecs_service" "this" {
  for_each        = var.services
  name            = "${var.name}-${each.key}"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.this[each.key].arn
  desired_count   = each.value.desired_count

  capacity_provider_strategy {
    capacity_provider = "FARGATE_SPOT"
    weight            = 7
    base              = 0
  }

  capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight            = 3
    base              = 1
  }

  network_configuration {
    subnets          = var.assign_public_ip ? var.public_subnet_ids : var.private_subnet_ids
    security_groups  = [var.ecs_security_group_id]
    assign_public_ip = var.assign_public_ip
  }

  # Only attach to the ALB when the service has a path_prefix
  dynamic "load_balancer" {
    for_each = each.value.path_prefix != null ? [1] : []
    content {
      target_group_arn = aws_lb_target_group.this[each.key].arn
      container_name   = each.key
      container_port   = each.value.container_port
    }
  }

  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200

  lifecycle {
    ignore_changes = [task_definition, desired_count]
  }

  # Wait for the listener infrastructure before registering the service
  depends_on = [aws_lb_listener.http, aws_lb_listener.https, aws_lb_listener_rule.this]

  tags = var.tags
}

# ── Per-service auto-scaling ──────────────────────────────────────────────────

resource "aws_appautoscaling_target" "this" {
  for_each           = var.services
  max_capacity       = each.value.max_tasks
  min_capacity       = each.value.min_tasks
  resource_id        = "service/${aws_ecs_cluster.this.name}/${aws_ecs_service.this[each.key].name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "cpu" {
  for_each           = var.services
  name               = "${var.name}-${each.key}-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.this[each.key].resource_id
  scalable_dimension = aws_appautoscaling_target.this[each.key].scalable_dimension
  service_namespace  = aws_appautoscaling_target.this[each.key].service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = 60
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}
