
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { createClient } = require("@supabase/supabase-js");

const app = express();

app.use(cors());
app.use(express.json({ limit: "10kb" }));
app.use(express.static("public"));

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
);

function normalizePhone(phone) {
  let value = String(phone || "").replace(/[\s-]/g, "");

  if (value.startsWith("0")) {
    value = "+256" + value.slice(1);
  } else if (value.startsWith("256")) {
    value = "+" + value;
  }

  if (!/^\+2567\d{8}$/.test(value)) {
    throw new Error("Enter a valid Uganda mobile number");
  }

  return value;
}

function createToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: "12h"
  });
}

// MEMBER REGISTRATION
app.post("/api/register", async (req, res) => {
  try {
    const { full_name, phone, password } = req.body;

    if (!full_name || !phone || !password) {
      return res.status(400).json({
        message: "All fields are required"
      });
    }

    if (String(password).length < 8) {
      return res.status(400).json({
        message: "Password must be at least 8 characters"
      });
    }

    const normalizedPhone = normalizePhone(phone);
    const password_hash = await bcrypt.hash(password, 12);

    const { data, error } = await supabase
      .from("members")
      .insert({
        full_name: String(full_name).trim(),
        phone: normalizedPhone,
        password_hash
      })
      .select("id, full_name, phone")
      .single();

    if (error) {
      if (error.code === "23505") {
        return res.status(409).json({
          message: "Phone number already registered"
        });
      }
      throw error;
    }

    res.status(201).json({
      message: "Registration successful",
      member: data
    });

  } catch (error) {
    res.status(400).json({
      message: error.message || "Registration failed"
    });
  }
});

// MEMBER LOGIN
app.post("/api/login", async (req, res) => {
  try {
    const { phone, password } = req.body;
    const normalizedPhone = normalizePhone(phone);

    const { data: member, error } = await supabase
      .from("members")
      .select("*")
      .eq("phone", normalizedPhone)
      .maybeSingle();

    if (error) throw error;

    if (!member || !(await bcrypt.compare(
      password || "",
      member.password_hash
    ))) {
      return res.status(401).json({
        message: "Incorrect phone number or password"
      });
    }

    const token = createToken({
      id: member.id,
      role: "member"
    });

    res.json({
      message: "Login successful",
      token,
      member: {
        id: member.id,
        full_name: member.full_name,
        phone: member.phone,
        balance: member.balance
      }
    });

  } catch (error) {
    res.status(400).json({
      message: error.message || "Login failed"
    });
  }
});

// ADMIN LOGIN
app.post("/api/admin/login", (req, res) => {
  try {
    const { phone, password } = req.body;

    const adminPhone = normalizePhone(phone);
    const configuredPhone = normalizePhone(
      process.env.ADMIN_PHONE
    );

    const supplied = Buffer.from(String(password || ""));
    const expected = Buffer.from(
      process.env.ADMIN_PASSWORD || ""
    );

    const validPassword =
      expected.length > 0 &&
      supplied.length === expected.length &&
      require("crypto").timingSafeEqual(supplied, expected);

    if (
      adminPhone !== configuredPhone ||
      !validPassword
    ) {
      return res.status(401).json({
        message: "Invalid administrator credentials"
      });
    }

    const token = createToken({
      role: "admin"
    });

    res.json({
      message: "Admin login successful",
      token,
      role: "admin"
    });

  } catch (error) {
    res.status(401).json({
      message: "Admin login failed"
    });
  }
});

// CHECK SERVER
app.get("/health", (req, res) => {
  res.json({
    name: "Archery AI Hub",
    status: "healthy"
  });
});

app.get("/", (req, res) => {
  res.json({
    name: "Archery AI Hub",
    status: "online",
    message: "Welcome to Archery AI Hub!"
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Archery AI Hub running on port ${PORT}`);
});
